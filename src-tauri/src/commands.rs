use crate::audio::{enumerate_devices, AudioSource, MicSource};
use crate::errors::{AppError, Result};
use crate::settings::{AppSettings, SettingsManager};
use crate::transcribe::cloud::GroqTranscriber;
use crate::transcribe::Transcriber;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, State};

// ── Shared recording state ────────────────────────────────────────────────────

/// Held in Tauri managed state. Stores PCM captured during a recording session.
pub struct RecordingState {
    pub pcm: Mutex<Option<Vec<f32>>>,
}

impl Default for RecordingState {
    fn default() -> Self {
        Self {
            pcm: Mutex::new(None),
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

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptResult {
    pub text: String,
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<AppSettings> {
    SettingsManager::new(app).get_settings()
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<()> {
    SettingsManager::new(app).save_settings(&settings)
}

#[tauri::command]
pub fn get_devices() -> Result<Vec<AudioDevice>> {
    let devices = enumerate_devices()?;
    if devices.is_empty() {
        // Fallback so the UI always has something to show.
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

/// Capture audio from the microphone for `duration_secs` seconds and store the
/// PCM in managed state so `stop_recording` can transcribe it.
#[tauri::command]
pub fn start_recording(
    app: AppHandle,
    state: State<RecordingState>,
    duration_secs: Option<u64>,
) -> Result<()> {
    let settings = SettingsManager::new(app).get_settings()?;
    let secs = duration_secs.unwrap_or(30);

    let mut source = MicSource::new(settings.mic_device_id);
    let pcm = source.record(secs)?;

    *state.pcm.lock().unwrap() = Some(pcm);
    Ok(())
}

/// Transcribe the PCM captured by `start_recording` and return the transcript.
/// Clears the stored PCM after transcription.
#[tauri::command]
pub fn stop_recording(app: AppHandle, state: State<RecordingState>) -> Result<TranscriptResult> {
    let pcm = state
        .pcm
        .lock()
        .unwrap()
        .take()
        .ok_or_else(|| AppError::Audio("No recording in progress".to_string()))?;

    let settings = SettingsManager::new(app).get_settings()?;

    let text = match settings.transcription_mode {
        crate::settings::TranscriptionMode::Cloud => {
            let key = settings
                .groq_api_key
                .ok_or_else(|| AppError::Transcription("Groq API key not set".to_string()))?;
            let transcriber = GroqTranscriber::new(key, settings.cloud_model);
            transcriber.transcribe(&pcm)?
        }
        crate::settings::TranscriptionMode::Local => {
            // Local Whisper is Phase 2 task 4 — placeholder until implemented.
            return Err(AppError::Transcription(
                "Local transcription not yet implemented".to_string(),
            ));
        }
    };

    Ok(TranscriptResult { text })
}
