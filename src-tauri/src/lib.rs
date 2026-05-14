pub mod errors;
pub mod settings;

use tauri::Manager;
use tracing_subscriber::{fmt, EnvFilter};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
