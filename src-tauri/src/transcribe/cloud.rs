use crate::errors::{AppError, Result};
use crate::transcribe::Transcriber;
use reqwest::blocking::multipart;
use std::io::Write;
use tempfile::Builder as TempBuilder;

const GROQ_TRANSCRIPTION_URL: &str = "https://api.groq.com/openai/v1/audio/transcriptions";

const REQUEST_TIMEOUT_SECS: u64 = 60;

pub struct GroqTranscriber {
    api_key: String,
    model: String,
}

impl GroqTranscriber {
    pub fn new(api_key: impl Into<String>, model: impl Into<String>) -> Self {
        Self {
            api_key: api_key.into(),
            model: model.into(),
        }
    }
}

impl Transcriber for GroqTranscriber {
    fn transcribe(&self, pcm: &[f32]) -> Result<String> {
        // Write PCM to a temp WAV with .wav extension so Groq accepts it.
        let wav_bytes = pcm_to_wav_bytes(pcm)?;
        let mut tmp = TempBuilder::new()
            .suffix(".wav")
            .tempfile()
            .map_err(|e| AppError::Transcription(e.to_string()))?;
        tmp.write_all(&wav_bytes)
            .map_err(|e| AppError::Transcription(e.to_string()))?;
        tmp.flush()
            .map_err(|e| AppError::Transcription(e.to_string()))?;
        let tmp_path = tmp.path().to_owned();

        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .build()
            .map_err(|e| AppError::Transcription(e.to_string()))?;

        let form = multipart::Form::new()
            .file("file", &tmp_path)
            .map_err(|e| AppError::Transcription(e.to_string()))?
            .text("model", self.model.clone())
            .text("response_format", "json");

        // Keep tmp alive until after the request so the file isn't deleted early.
        let _tmp = tmp;

        let response = client
            .post(GROQ_TRANSCRIPTION_URL)
            .bearer_auth(&self.api_key)
            .multipart(form)
            .send()
            .map_err(|e| AppError::Transcription(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            return Err(AppError::Transcription(format!(
                "Groq API error {}",
                status
            )));
        }

        let json: serde_json::Value = response
            .json()
            .map_err(|e| AppError::Transcription(e.to_string()))?;

        json["text"]
            .as_str()
            .map(|s| s.trim().to_string())
            .ok_or_else(|| AppError::Transcription("Missing 'text' in Groq response".to_string()))
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Encode mono f32 PCM at 16 kHz into a minimal WAV byte buffer.
fn pcm_to_wav_bytes(pcm: &[f32]) -> Result<Vec<u8>> {
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: crate::audio::TARGET_SAMPLE_RATE,
        bits_per_sample: 32,
        sample_format: hound::SampleFormat::Float,
    };

    let mut cursor = std::io::Cursor::new(Vec::new());
    {
        let mut writer = hound::WavWriter::new(&mut cursor, spec)
            .map_err(|e| AppError::Transcription(e.to_string()))?;
        for &sample in pcm {
            writer
                .write_sample(sample)
                .map_err(|e| AppError::Transcription(e.to_string()))?;
        }
        writer
            .finalize()
            .map_err(|e| AppError::Transcription(e.to_string()))?;
    }

    Ok(cursor.into_inner())
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pcm_to_wav_bytes_produces_valid_wav() {
        let pcm: Vec<f32> = (0..160).map(|i| (i as f32 / 160.0) * 0.5).collect();
        let bytes = pcm_to_wav_bytes(&pcm).unwrap();
        // WAV magic bytes: "RIFF"
        assert_eq!(&bytes[0..4], b"RIFF");
    }

    #[test]
    #[ignore = "requires GROQ_API_KEY"]
    fn groq_transcriber_live() {
        let key = std::env::var("GROQ_API_KEY").expect("GROQ_API_KEY not set");
        let transcriber = GroqTranscriber::new(key, "whisper-large-v3-turbo");

        // 1 second of silence
        let pcm = vec![0.0f32; 16_000];
        let result = transcriber.transcribe(&pcm);
        // Silence may return empty string or an error — just check it doesn't panic.
        let _ = result;
    }
}
