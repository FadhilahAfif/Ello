use crate::commands::RecordingState;
use crate::errors::AppError;
use crate::settings::{HotkeyMode, SettingsManager};
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

pub const DEFAULT_HOTKEY: &str = "Alt+Shift+D";

pub fn register_hotkeys(app: &AppHandle) -> Result<(), AppError> {
    let settings = SettingsManager::new(app.clone())
        .get_settings()
        .map_err(|e| AppError::Hotkey(e.to_string()))?;

    // NOTE: hotkey_mode is captured at registration time. If the user changes
    // the hotkey mode in settings, call unregister_hotkeys + register_hotkeys
    // to pick up the new mode. The app currently requires a restart for this.
    let hotkey_mode = settings.hotkey_mode;
    let app_clone = app.clone();

    app.global_shortcut()
        .on_shortcut(DEFAULT_HOTKEY, move |_app, _shortcut, event| {
            let state = app_clone.state::<RecordingState>();
            match hotkey_mode {
                HotkeyMode::Toggle => {
                    if event.state == ShortcutState::Pressed {
                        if state.is_recording.load(Ordering::SeqCst) {
                            state.should_stop.store(true, Ordering::SeqCst);
                        } else {
                            let app2 = app_clone.clone();
                            std::thread::spawn(move || {
                                if let Err(e) = crate::commands::trigger_start_recording(app2) {
                                    tracing::error!("Hotkey start failed: {}", e);
                                }
                            });
                        }
                    }
                }
                HotkeyMode::PushToTalk => {
                    if event.state == ShortcutState::Pressed
                        && !state.is_recording.load(Ordering::SeqCst)
                    {
                        let app2 = app_clone.clone();
                        std::thread::spawn(move || {
                            if let Err(e) = crate::commands::trigger_start_recording(app2) {
                                tracing::error!("Hotkey start failed: {}", e);
                            }
                        });
                    } else if event.state == ShortcutState::Released
                        && state.is_recording.load(Ordering::SeqCst)
                    {
                        state.should_stop.store(true, Ordering::SeqCst);
                    }
                }
            }
        })
        .map_err(|e| AppError::Hotkey(format!("Failed to register hotkey {}: {}", DEFAULT_HOTKEY, e)))?;

    tracing::info!("Registered hotkey: {}", DEFAULT_HOTKEY);
    Ok(())
}

/// Unregisters the global hotkey. Call this before re-registering after a
/// settings change. The OS reclaims shortcuts on process exit automatically.
#[allow(dead_code)]
pub fn unregister_hotkeys(app: &AppHandle) {
    let _ = app.global_shortcut().unregister(DEFAULT_HOTKEY);
}
