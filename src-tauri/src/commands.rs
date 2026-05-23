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

    app.emit("overlay-settings-changed", &settings.overlay)
        .map_err(|e| AppError::Settings(e.to_string()))?;

    if let Err(e) = set_overlay_geometry(app, settings.overlay.style, settings.overlay.position) {
        tracing::warn!("Failed to apply overlay geometry after settings save: {}", e);
    }

    Ok(())
}

#[tauri::command]
pub fn set_overlay_geometry(
    app: AppHandle,
    style: crate::settings::OverlayStyle,
    position: crate::settings::OverlayPosition,
) -> Result<()> {
    let overlay = match app.get_webview_window("overlay") {
        Some(w) => w,
        None => return Ok(()),
    };

    let monitor = overlay
        .primary_monitor()
        .ok()
        .flatten()
        .ok_or_else(|| AppError::Settings("No primary monitor".into()))?;

    let screen_w = monitor.size().width as i32;
    let screen_h = monitor.size().height as i32;

    const CARD_W: i32 = 320;
    const CARD_H: i32 = 60;
    const DOT_W: i32 = 32;
    const DOT_H: i32 = 32;
    const PILL_W: i32 = 220;
    const PILL_H: i32 = 44;

    let (win_w, win_h): (i32, i32) = match style {
        crate::settings::OverlayStyle::Card => (CARD_W, CARD_H),
        crate::settings::OverlayStyle::Dot => (DOT_W, DOT_H),
        crate::settings::OverlayStyle::Pill => (PILL_W, PILL_H),
    };

    let margin = 16i32;

    let (x, y) = match position {
        crate::settings::OverlayPosition::TopLeft => (margin, 0),
        crate::settings::OverlayPosition::TopCenter => ((screen_w - win_w) / 2, 0),
        crate::settings::OverlayPosition::TopRight => (screen_w - win_w - margin, 0),
        crate::settings::OverlayPosition::BottomLeft => (margin, screen_h - win_h - margin),
        crate::settings::OverlayPosition::BottomCenter => {
            ((screen_w - win_w) / 2, screen_h - win_h - margin)
        }
        crate::settings::OverlayPosition::BottomRight => {
            (screen_w - win_w - margin, screen_h - win_h - margin)
        }
    };

    overlay.hide().ok();
    overlay
        .set_size(tauri::PhysicalSize::new(win_w as u32, win_h as u32))
        .map_err(|e| AppError::Settings(e.to_string()))?;
    overlay
        .set_position(tauri::PhysicalPosition::new(x, y))
        .map_err(|e| AppError::Settings(e.to_string()))?;
    overlay.show().ok();
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
    let mut source = MicSource::new_chunked(settings.mic_device_id.clone(), should_stop)
        .with_app_handle(app.clone());
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
                .clone()
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

    // Step 1: Always apply vocabulary rules (regardless of history_enabled)
    let text = match db_state.lock() {
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
    };

    // Step 2: Optionally apply AI polish (soft-fail — never blocks output)
    let text = {
        let should_polish = settings.ai_polish.enabled
            && settings.groq_api_key.is_some()
            && text.split_whitespace().count() >= settings.ai_polish.min_word_count as usize;
        if should_polish {
            let api_key = settings.groq_api_key.as_deref().unwrap_or("");
            match crate::polish::run(&text, &settings.ai_polish, api_key) {
                Ok(polished) => polished,
                Err(e) => {
                    tracing::warn!("AI polish failed, using raw transcript: {}", e);
                    if let Err(emit_err) = app.emit(
                        "polish-failed",
                        serde_json::json!({ "reason": e.to_string() }),
                    ) {
                        tracing::warn!("Failed to emit polish-failed: {}", emit_err);
                    }
                    text
                }
            }
        } else {
            text
        }
    };

    // Step 3: Persist transcript + stats when history is enabled
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
