use crate::errors::{AppError, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use rubato::{FftFixedIn, Resampler};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// Target sample rate for Whisper and Groq.
pub const TARGET_SAMPLE_RATE: u32 = 16_000;
/// Maximum recording length to prevent unbounded memory use.
pub const MAX_RECORDING_SECS: u64 = 300;

// ── Trait ─────────────────────────────────────────────────────────────────────

/// Anything that can produce a mono 16 kHz f32 PCM buffer.
pub trait AudioSource: Send {
    fn record(&mut self, max_secs: u64) -> Result<Vec<f32>>;
}

// ── Device enumeration ────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

pub fn enumerate_devices() -> Result<Vec<DeviceInfo>> {
    let host = cpal::default_host();
    let default_name = host
        .default_input_device()
        .and_then(|d| d.name().ok())
        .unwrap_or_default();

    let devices = host
        .input_devices()
        .map_err(|e| AppError::Audio(e.to_string()))?
        .filter_map(|d| d.name().ok())
        .map(|name| {
            let is_default = name == default_name;
            DeviceInfo {
                id: name.clone(),
                name: name.clone(),
                is_default,
            }
        })
        .collect();

    Ok(devices)
}

// ── MicSource ─────────────────────────────────────────────────────────────────

/// Records from a CPAL input device, downmixes to mono, resamples to 16 kHz.
pub struct MicSource {
    device_name: Option<String>,
    should_stop: Option<Arc<AtomicBool>>,
    app_handle: Option<tauri::AppHandle>,
}

impl MicSource {
    pub fn new(device_name: Option<String>) -> Self {
        Self {
            device_name,
            should_stop: None,
            app_handle: None,
        }
    }

    pub fn new_chunked(device_name: Option<String>, should_stop: Arc<AtomicBool>) -> Self {
        Self {
            device_name,
            should_stop: Some(should_stop),
            app_handle: None,
        }
    }

    pub fn with_app_handle(mut self, app: tauri::AppHandle) -> Self {
        self.app_handle = Some(app);
        self
    }
}

impl AudioSource for MicSource {
    fn record(&mut self, max_secs: u64) -> Result<Vec<f32>> {
        let max_secs = max_secs.min(MAX_RECORDING_SECS);
        let host = cpal::default_host();

        let device = match &self.device_name {
            Some(name) => host
                .input_devices()
                .map_err(|e| AppError::Audio(e.to_string()))?
                .find(|d| d.name().ok().as_deref() == Some(name.as_str()))
                .ok_or_else(|| AppError::Audio(format!("Device '{}' not found", name)))?,
            None => host
                .default_input_device()
                .ok_or_else(|| AppError::Audio("No default input device".to_string()))?,
        };

        let config = device
            .default_input_config()
            .map_err(|e| AppError::Audio(e.to_string()))?;

        let sample_rate = config.sample_rate().0;
        let channels = config.channels() as usize;
        let max_samples = (sample_rate as u64 * max_secs) as usize * channels;

        let buffer: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::new()));
        let buffer_clone = Arc::clone(&buffer);

        // Shared state for RMS throttle — last emit timestamp.
        let last_emit: Arc<Mutex<Instant>> = Arc::new(Mutex::new(Instant::now()));
        let last_emit_clone = Arc::clone(&last_emit);
        let app_handle_clone = self.app_handle.clone();

        let stream = device
            .build_input_stream(
                &config.into(),
                move |data: &[f32], _| {
                    let mut buf = buffer_clone.lock().unwrap();
                    if buf.len() < max_samples {
                        buf.extend_from_slice(data);
                    }

                    // Compute RMS of this callback chunk and emit mic-level at ≤30 Hz.
                    if let Some(ref app) = app_handle_clone {
                        let mut last = last_emit_clone.lock().unwrap();
                        if last.elapsed() >= Duration::from_millis(33) {
                            *last = Instant::now();
                            let rms = if data.is_empty() {
                                0.0f32
                            } else {
                                let sum_sq: f32 = data.iter().map(|s| s * s).sum();
                                (sum_sq / data.len() as f32).sqrt()
                            };
                            let level = rms.clamp(0.0, 1.0);
                            if let Err(e) = tauri::Emitter::emit(app, "mic-level", level) {
                                tracing::warn!("Failed to emit mic-level: {}", e);
                            }
                        }
                    }
                },
                |e| tracing::error!("Audio stream error: {}", e),
                Some(Duration::from_secs(max_secs)),
            )
            .map_err(|e| AppError::Audio(e.to_string()))?;

        stream.play().map_err(|e| AppError::Audio(e.to_string()))?;

        // Poll until deadline reached or should_stop flag is set.
        let poll_interval = Duration::from_millis(50);
        let deadline = std::time::Instant::now() + Duration::from_secs(max_secs);
        loop {
            std::thread::sleep(poll_interval);
            if let Some(ref flag) = self.should_stop {
                if flag.load(Ordering::SeqCst) {
                    break;
                }
            }
            if std::time::Instant::now() >= deadline {
                break;
            }
        }

        drop(stream);

        let raw = Arc::try_unwrap(buffer)
            .map_err(|_| AppError::Audio("Buffer lock contention".to_string()))?
            .into_inner()
            .unwrap();

        let mono = downmix_to_mono(raw, channels);
        resample(mono, sample_rate, TARGET_SAMPLE_RATE)
    }
}

// ── WavSource ─────────────────────────────────────────────────────────────────

/// Reads a WAV file, downmixes to mono, resamples to 16 kHz.
/// Used for tests and fixture-based pipeline runs.
pub struct WavSource {
    path: std::path::PathBuf,
}

impl WavSource {
    pub fn new(path: impl Into<std::path::PathBuf>) -> Self {
        Self { path: path.into() }
    }
}

impl AudioSource for WavSource {
    fn record(&mut self, _max_secs: u64) -> Result<Vec<f32>> {
        let mut reader =
            hound::WavReader::open(&self.path).map_err(|e| AppError::Audio(e.to_string()))?;

        let spec = reader.spec();
        let channels = spec.channels as usize;
        let sample_rate = spec.sample_rate;

        let samples: Vec<f32> = match spec.sample_format {
            hound::SampleFormat::Float => reader
                .samples::<f32>()
                .collect::<std::result::Result<_, _>>()
                .map_err(|e| AppError::Audio(e.to_string()))?,
            hound::SampleFormat::Int => {
                let max = (1i64 << (spec.bits_per_sample - 1)) as f32;
                reader
                    .samples::<i32>()
                    .collect::<std::result::Result<Vec<_>, _>>()
                    .map_err(|e| AppError::Audio(e.to_string()))?
                    .into_iter()
                    .map(|s| s as f32 / max)
                    .collect()
            }
        };

        let mono = downmix_to_mono(samples, channels);
        resample(mono, sample_rate, TARGET_SAMPLE_RATE)
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn downmix_to_mono(samples: Vec<f32>, channels: usize) -> Vec<f32> {
    if channels == 1 {
        return samples;
    }
    samples
        .chunks_exact(channels)
        .map(|frame| frame.iter().sum::<f32>() / channels as f32)
        .collect()
}

fn resample(samples: Vec<f32>, from_rate: u32, to_rate: u32) -> Result<Vec<f32>> {
    if from_rate == to_rate {
        return Ok(samples);
    }

    let chunk_size = 1024usize;
    let mut resampler =
        FftFixedIn::<f32>::new(from_rate as usize, to_rate as usize, chunk_size, 2, 1)
            .map_err(|e| AppError::Audio(e.to_string()))?;

    let mut output = Vec::new();
    let mut pos = 0;

    while pos < samples.len() {
        let end = (pos + chunk_size).min(samples.len());
        let mut chunk = samples[pos..end].to_vec();
        // Pad last chunk if needed
        chunk.resize(chunk_size, 0.0);
        pos += chunk_size;

        let resampled = resampler
            .process(&[chunk], None)
            .map_err(|e| AppError::Audio(e.to_string()))?;

        output.extend_from_slice(&resampled[0]);
    }

    Ok(output)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn downmix_stereo_to_mono() {
        // L=1.0, R=0.0 → mono=0.5
        let stereo = vec![1.0f32, 0.0, 1.0, 0.0];
        let mono = downmix_to_mono(stereo, 2);
        assert_eq!(mono.len(), 2);
        assert!((mono[0] - 0.5).abs() < 1e-6);
    }

    #[test]
    fn resample_passthrough_when_rates_equal() {
        let samples = vec![0.1f32, 0.2, 0.3];
        let out = resample(samples.clone(), 16_000, 16_000).unwrap();
        assert_eq!(out, samples);
    }

    #[test]
    fn wav_source_reads_fixture() {
        let fixture = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests")
            .join("fixtures")
            .join("hello.wav");
        if !fixture.exists() {
            return; // fixture not present in CI — skip
        }
        let mut src = WavSource::new(&fixture);
        let pcm = src.record(60).unwrap();
        assert!(!pcm.is_empty());
    }
}
