use crate::errors::{AppError, Result};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

pub const SETTINGS_FILE: &str = "settings.json";

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub schema_version: u16,
    pub groq_api_key: Option<String>,
    pub cloud_model: String,
    pub transcription_mode: TranscriptionMode,
    pub hotkey_mode: HotkeyMode,
    pub autostart_enabled: bool,
    pub mic_device_id: Option<String>,
    pub local_model_path: Option<String>,
    pub language: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum TranscriptionMode {
    #[default]
    Cloud,
    Local,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum HotkeyMode {
    #[default]
    Toggle,
    PushToTalk,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            schema_version: 1,
            groq_api_key: None,
            cloud_model: "whisper-large-v3-turbo".to_string(),
            transcription_mode: TranscriptionMode::default(),
            hotkey_mode: HotkeyMode::default(),
            autostart_enabled: false,
            mic_device_id: None,
            local_model_path: None,
            language: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn default_settings_include_versioned_schema() {
        let settings = serde_json::to_value(AppSettings::default()).unwrap();

        assert_eq!(settings["schemaVersion"], json!(1));
    }
}

pub struct SettingsManager {
    app_handle: AppHandle,
}

impl SettingsManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    pub fn get_settings(&self) -> Result<AppSettings> {
        let store = self
            .app_handle
            .store(SETTINGS_FILE)
            .map_err(|e| AppError::Settings(e.to_string()))?;

        if let Some(val) = store.get("settings") {
            serde_json::from_value(val).map_err(|e| AppError::Settings(e.to_string()))
        } else {
            Ok(AppSettings::default())
        }
    }

    pub fn save_settings(&self, settings: &AppSettings) -> Result<()> {
        let store = self
            .app_handle
            .store(SETTINGS_FILE)
            .map_err(|e| AppError::Settings(e.to_string()))?;

        let val = serde_json::to_value(settings).map_err(|e| AppError::Settings(e.to_string()))?;

        store.set("settings", val);
        store
            .save()
            .map_err(|e| AppError::Settings(e.to_string()))?;
        Ok(())
    }
}
