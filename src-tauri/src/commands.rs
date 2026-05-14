use crate::errors::Result;
use crate::settings::{AppSettings, SettingsManager};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<AppSettings> {
    SettingsManager::new(app).get_settings()
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<()> {
    SettingsManager::new(app).save_settings(&settings)
}

/// Returns available input audio devices.
/// Phase 2 will wire this to `cpal`; for now we return a placeholder so the
/// frontend selector has something to render and the command contract is set.
#[tauri::command]
pub fn get_devices() -> Result<Vec<AudioDevice>> {
    Ok(vec![AudioDevice {
        id: "default".to_string(),
        name: "Default Microphone".to_string(),
        is_default: true,
    }])
}
