use crate::audio::{enumerate_devices, AudioSource, MicSource, MAX_RECORDING_SECS};
use crate::errors::{AppError, Result};
use crate::output::{FallbackSink, OutputSink};
use crate::settings::SettingsManager;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};

// ── Shared recording state ────────────────────────────────────────────────────

/// Held in Tauri managed state. Coordinates the recording thread lifecycle.
pub struct RecordingState {
    pub is_recording: Arc<AtomicBool>,
    pub should_stop: Arc<AtomicBool>,
}

impl Default for RecordingState {
    fn default() -> Self {
        Self {
            is_recording: Arc::new(AtomicBool::new(false)),
            should_stop: Arc::new(AtomicBool::new(false)),
        }
    }
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<crate::settings::AppSettings> {
    SettingsManager::new(app).get_settings()
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: crate::settings::AppSettings) -> Result<()> {
    SettingsManager::new(app).save_settings(&settings)
}

#[tauri::command]
pub fn get_devices() -> Result<Vec<AudioDevice>> {
    let devices = enumerate_devices()?;
    if devices.is_empty() {
        return Ok(vec![AudioDevice {
            id: "default".to_string(),
            name: "Default Microphone".to_string(),
            is_default: true,
        }]);
    }
    Ok(devices
        .into_iter()
        .map(|d| AudioDevice {
            id: d.id,
            name: d.name,
            is_default: d.is_default,
        })
        .collect())
}

/// Called by both the Tauri command and the hotkey handler.
pub fn trigger_start_recording(app: AppHandle) -> Result<()> {
    let state = app.state::<RecordingState>();

    // Atomically claim the recording slot; bail if already recording.
    if state
        .is_recording
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Ok(()); // already recording, ignore
    }
    // We now own is_recording=true; safe to reset should_stop.
    state.should_stop.store(false, Ordering::SeqCst);

    let app_clone = app.clone();
    let is_recording = Arc::clone(&state.is_recording);
    let should_stop = Arc::clone(&state.should_stop);
    let settings = SettingsManager::new(app.clone()).get_settings()?;

    if let Err(e) = app.emit("recording-started", ()) {
        tracing::warn!("Failed to emit recording-started: {}", e);
    }

    std::thread::spawn(move || {
        let result = run_recording_pipeline(&app_clone, settings, should_stop);
        is_recording.store(false, Ordering::SeqCst);
        if let Err(e) = result {
            tracing::error!("Recording pipeline error: {}", e);
            app_clone
                .emit(
                    "app-error",
                    serde_json::json!({ "message": e.to_string() }),
                )
                .ok();
        }
    });

    Ok(())
}

fn run_recording_pipeline(
    app: &AppHandle,
    settings: crate::settings::AppSettings,
    should_stop: Arc<AtomicBool>,
) -> Result<()> {
    let mut source = MicSource::new_chunked(settings.mic_device_id.clone(), should_stop);
    let raw_pcm = source.record(MAX_RECORDING_SECS)?;

    if let Err(e) = app.emit("recording-stopped", ()) {
        tracing::warn!("Failed to emit recording-stopped: {}", e);
    }
    if let Err(e) = app.emit("transcription-started", ()) {
        tracing::warn!("Failed to emit transcription-started: {}", e);
    }

    let text = match settings.transcription_mode {
        crate::settings::TranscriptionMode::Cloud => {
            let key = settings.groq_api_key.ok_or_else(|| {
                AppError::Transcription("Groq API key not set".to_string())
            })?;
            let transcriber =
                crate::transcribe::cloud::GroqTranscriber::new(key, settings.cloud_model);
            crate::transcribe::Transcriber::transcribe(&transcriber, &raw_pcm)?
        }
        crate::settings::TranscriptionMode::Local => {
            let model_path = settings.local_model_path.ok_or_else(|| {
                AppError::Transcription("Local model path not configured".to_string())
            })?;
            let transcriber = crate::transcribe::local::LocalWhisperTranscriber::new(
                model_path,
                settings.language.clone(),
            );
            crate::transcribe::Transcriber::transcribe(&transcriber, &raw_pcm)?
        }
    };

    if let Err(e) = app.emit("transcription-done", serde_json::json!({ "text": text })) {
        tracing::warn!("Failed to emit transcription-done: {}", e);
    }

    FallbackSink.output(&text)?;

    Ok(())
}

/// Tauri command entry point; delegates to [`trigger_start_recording`].
#[tauri::command]
pub fn start_recording(app: AppHandle) -> Result<()> {
    trigger_start_recording(app)
}

#[tauri::command]
pub fn stop_recording(state: State<RecordingState>) -> Result<()> {
    if !state.is_recording.load(Ordering::SeqCst) {
        return Ok(()); // not recording, ignore silently
    }
    state.should_stop.store(true, Ordering::SeqCst);
    Ok(())
}
