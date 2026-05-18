use crate::audio::{enumerate_devices, AudioSource, MicSource, MAX_RECORDING_SECS};
use crate::errors::{AppError, Result};
use crate::output::{FallbackSink, OutputSink};
use crate::settings::SettingsManager;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
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
    // Read the old hotkey before overwriting so we can unregister it
    let old_hotkey = SettingsManager::new(app.clone())
        .get_settings()
        .map(|s| s.hotkey)
        .unwrap_or_else(|_| crate::hotkey::DEFAULT_HOTKEY.to_string());

    SettingsManager::new(app.clone()).save_settings(&settings)?;

    // Re-register hotkey so mode and binding changes take effect immediately
    if let Err(e) = crate::hotkey::reregister_hotkeys(&app, &old_hotkey) {
        tracing::warn!("Failed to re-register hotkey after settings save: {}", e);
        if let Err(emit_err) = app.emit(
            "app-error",
            serde_json::json!({ "message": format!("Hotkey registration failed: {}", e) }),
        ) {
            tracing::warn!("Failed to emit hotkey error: {}", emit_err);
        }
    }

    Ok(())
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
                .emit("app-error", serde_json::json!({ "message": e.to_string() }))
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
    let record_start = Instant::now();
    let mut source = MicSource::new_chunked(settings.mic_device_id.clone(), should_stop);
    let raw_pcm = source.record(MAX_RECORDING_SECS)?;
    let duration_ms = record_start.elapsed().as_millis() as i64;

    if let Err(e) = app.emit("recording-stopped", ()) {
        tracing::warn!("Failed to emit recording-stopped: {}", e);
    }
    if let Err(e) = app.emit("transcription-started", ()) {
        tracing::warn!("Failed to emit transcription-started: {}", e);
    }

    let mode_str;
    let model_str;
    let text = match settings.transcription_mode {
        crate::settings::TranscriptionMode::Cloud => {
            mode_str = "cloud".to_string();
            model_str = settings.cloud_model.clone();
            let key = settings
                .groq_api_key
                .ok_or_else(|| AppError::Transcription("Groq API key not set".to_string()))?;
            let transcriber =
                crate::transcribe::cloud::GroqTranscriber::new(key, settings.cloud_model);
            crate::transcribe::Transcriber::transcribe(&transcriber, &raw_pcm)?
        }
        crate::settings::TranscriptionMode::Local => {
            mode_str = "local".to_string();
            let model_path = settings.local_model_path.ok_or_else(|| {
                AppError::Transcription("Local model path not configured".to_string())
            })?;
            model_str = model_path.clone();
            let transcriber = crate::transcribe::local::LocalWhisperTranscriber::new(
                model_path,
                settings.language.clone(),
            );
            crate::transcribe::Transcriber::transcribe(&transcriber, &raw_pcm)?
        }
    };

    // Get DB state once so it lives for the rest of the function
    let db_state = app.state::<crate::db::Db>();

    // Apply vocabulary replacements
    let text = if settings.history_enabled {
        match db_state.lock() {
            Ok(conn) => {
                let rules: Vec<crate::vocabulary::VocabularyRule> = conn
                    .prepare("SELECT id, term, replacement, case_sensitive, kind FROM vocabulary ORDER BY id ASC")
                    .map(|mut stmt| {
                        stmt.query_map([], |row| {
                            Ok(crate::vocabulary::VocabularyRule {
                                id: row.get(0)?,
                                term: row.get(1)?,
                                replacement: row.get(2)?,
                                case_sensitive: row.get::<_, i64>(3)? != 0,
                                kind: row.get(4)?,
                            })
                        })
                        .map(|rows| rows.filter_map(|r| r.ok()).collect::<Vec<_>>())
                        .unwrap_or_default()
                    })
                    .unwrap_or_default();
                crate::vocabulary::apply_rules(&text, &rules)
            }
            Err(e) => {
                tracing::warn!("Could not lock DB for vocabulary: {}", e);
                text
            }
        }
    } else {
        text
    };

    // Persist transcript + stats when history is enabled
    if settings.history_enabled {
        match db_state.lock() {
            Ok(conn) => {
                let word_count = text.split_whitespace().count() as i64;
                if let Err(e) = crate::history::insert_transcript(
                    &conn,
                    &text,
                    &mode_str,
                    &model_str,
                    duration_ms,
                ) {
                    tracing::warn!("Failed to insert transcript: {}", e);
                }
                if settings.stats_enabled {
                    if let Err(e) = crate::stats::bump_stats(&conn, word_count, duration_ms) {
                        tracing::warn!("Failed to bump stats: {}", e);
                    }
                }
            }
            Err(e) => {
                tracing::warn!("Could not lock DB for history/stats: {}", e);
            }
        }
    }

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
