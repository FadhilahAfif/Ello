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

    let hotkey = settings.hotkey.clone();

    // NOTE: hotkey_mode is captured at registration time. If the user changes
    // the hotkey mode in settings, call unregister_hotkeys + register_hotkeys
    // to pick up the new mode. The app currently requires a restart for this.
    let hotkey_mode = settings.hotkey_mode;
    let app_clone = app.clone();

    app.global_shortcut()
        .on_shortcut(hotkey.as_str(), move |_app, _shortcut, event| {
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
        .map_err(|e| AppError::Hotkey(format!("Failed to register hotkey {}: {}", hotkey, e)))?;

    tracing::info!("Registered hotkey: {}", hotkey);
    Ok(())
}

/// Unregisters the currently configured hotkey.
pub fn unregister_hotkeys(app: &AppHandle) {
    if let Ok(settings) = SettingsManager::new(app.clone()).get_settings() {
        let _ = app.global_shortcut().unregister(settings.hotkey.as_str());
    } else {
        // Fallback: try to unregister the default
        let _ = app.global_shortcut().unregister(DEFAULT_HOTKEY);
    }
}

/// Unregisters the old hotkey and registers the new one from current settings.
/// Call this after saving settings that may have changed the hotkey or mode.
pub fn reregister_hotkeys(app: &AppHandle, old_hotkey: &str) -> Result<(), AppError> {
    let _ = app.global_shortcut().unregister(old_hotkey);
    register_hotkeys(app)
}
