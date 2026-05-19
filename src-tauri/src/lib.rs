pub mod audio;
pub mod commands;
pub mod db;
pub mod errors;
pub mod history;
pub mod hotkey;
pub mod models;
pub mod output;
pub mod polish;
pub mod settings;
pub mod stats;
pub mod transcribe;
pub mod tray;
pub mod vocabulary;

use crate::commands::RecordingState;
use crate::db::Db;
use tauri::{Emitter, Manager};
use tracing_subscriber::{fmt, EnvFilter};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(RecordingState::default())
        .manage(models::DownloadState::default())
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

            let app_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))
                .map_err(|e| {
                    tracing::error!("Failed to load bundled app icon: {}", e);
                    e
                })?;

            if let Some(window) = app.get_webview_window("main") {
                if let Err(e) = window.set_icon(app_icon.clone()) {
                    tracing::warn!("Failed to set main window icon: {}", e);
                }
            }

            let db_path = app
                .path()
                .app_data_dir()
                .expect("failed to get app data directory")
                .join("ello.db");
            let db = Db::open(&db_path).expect("failed to open database");
            app.manage(db);

            if let Err(e) = crate::hotkey::register_hotkeys(app.handle()) {
                tracing::warn!("Could not register hotkeys: {}", e);
                if let Err(emit_err) = app.emit(
                    "app-error",
                    serde_json::json!({ "message": format!("Hotkey registration failed: {}", e) }),
                ) {
                    tracing::warn!("Failed to emit hotkey error: {}", emit_err);
                }
            }

            crate::tray::setup_tray(app.handle(), Some(app_icon.clone())).map_err(|e| {
                tracing::error!("Tray setup failed: {}", e);
                e
            })?;

            if let Some(overlay) = app.get_webview_window("overlay") {
                if let Ok(Some(monitor)) = overlay.primary_monitor() {
                    let screen_w = monitor.size().width as i32;
                    let win_w = 320i32;
                    let x = (screen_w - win_w) / 2;
                    overlay
                        .set_position(tauri::PhysicalPosition::new(x, 0))
                        .ok();
                }
                overlay.set_ignore_cursor_events(true).ok();
                overlay.show().ok();
            }

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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::get_devices,
            commands::start_recording,
            commands::stop_recording,
            models::get_model_manifest,
            models::download_model,
            models::cancel_download,
            models::validate_model,
            models::check_installed_models,
            history::history_list,
            history::history_get,
            history::history_delete,
            history::history_clear,
            history::history_export,
            vocabulary::vocabulary_list,
            vocabulary::vocabulary_upsert,
            vocabulary::vocabulary_delete,
            vocabulary::vocabulary_import_csv,
            stats::stats_summary,
            polish::polish_test,
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
