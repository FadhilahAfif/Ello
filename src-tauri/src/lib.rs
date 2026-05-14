pub mod audio;
pub mod commands;
pub mod errors;
pub mod hotkey;
pub mod models;
pub mod output;
pub mod settings;
pub mod transcribe;
pub mod tray;

use crate::commands::RecordingState;
use tauri::{Emitter, Manager};
use tracing_subscriber::{fmt, EnvFilter};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(RecordingState::default())
        .setup(|app| {
            let log_dir = app
                .path()
                .app_log_dir()
                .expect("failed to get app log directory");

            std::fs::create_dir_all(&log_dir).expect("failed to create log directory");

            let file_appender = tracing_appender::rolling::daily(log_dir, "ello.log");
            let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

            let subscriber = fmt::Subscriber::builder()
                .with_env_filter(
                    EnvFilter::from_default_env().add_directive(tracing::Level::INFO.into()),
                )
                .with_writer(non_blocking)
                .finish();

            tracing::subscriber::set_global_default(subscriber)
                .expect("setting default subscriber failed");
            app.manage(guard);

            tracing::info!("Ello dictation app started");

            if let Err(e) = crate::hotkey::register_hotkeys(app.handle()) {
                tracing::warn!("Could not register hotkeys: {}", e);
                if let Err(emit_err) = app.emit(
                    "app-error",
                    serde_json::json!({ "message": format!("Hotkey registration failed: {}", e) }),
                ) {
                    tracing::warn!("Failed to emit hotkey error: {}", emit_err);
                }
            }

            crate::tray::setup_tray(app.handle()).map_err(|e| {
                tracing::error!("Tray setup failed: {}", e);
                e
            })?;

            Ok(())
        })
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .args(["--silent"])
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::get_devices,
            commands::start_recording,
            commands::stop_recording,
        ])
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    if let Err(e) = window.hide() {
                        tracing::warn!("Failed to hide main window: {}", e);
                    }
                    api.prevent_close();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
