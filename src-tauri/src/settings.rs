use crate::errors::{AppError, Result};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

pub const SETTINGS_FILE: &str = "settings.json";

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AiPolishSettings {
    pub enabled: bool,
    pub model: String,
    pub prompt: String,
    pub min_word_count: u32,
}

impl Default for AiPolishSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            model: "llama-3.3-70b-versatile".to_string(),
            prompt: "Remove filler words and fix grammar without changing meaning.".to_string(),
            min_word_count: 10,
        }
    }
}

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
    pub hotkey: String,
    pub ai_polish: AiPolishSettings,
    pub history_enabled: bool,
    pub stats_enabled: bool,
    pub onboarding_complete: bool,
    pub last_seen_version: Option<String>,
    pub update_channel: String,
    pub theme: String,
    pub accent_color: String,
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
            schema_version: 2,
            groq_api_key: None,
            cloud_model: "whisper-large-v3-turbo".to_string(),
            transcription_mode: TranscriptionMode::default(),
            hotkey_mode: HotkeyMode::default(),
            autostart_enabled: false,
            mic_device_id: None,
            local_model_path: None,
            language: None,
            hotkey: crate::hotkey::DEFAULT_HOTKEY.to_string(),
            ai_polish: AiPolishSettings::default(),
            history_enabled: true,
            stats_enabled: true,
            onboarding_complete: false,
            last_seen_version: None,
            update_channel: "stable".to_string(),
            theme: "dark".to_string(),
            accent_color: "#7c5cff".to_string(),
        }
    }
}

fn migrate_to_v2(val: &mut serde_json::Value) {
    let defaults =
        serde_json::to_value(AppSettings::default()).expect("AppSettings is always serializable");
    let obj = match val.as_object_mut() {
        Some(o) => o,
        None => return,
    };
    for (key, default_val) in defaults.as_object().unwrap() {
        obj.entry(key).or_insert_with(|| default_val.clone());
    }
    obj.insert("schemaVersion".to_string(), serde_json::json!(2));
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn default_settings_include_versioned_schema() {
        let settings = serde_json::to_value(AppSettings::default()).unwrap();
        assert_eq!(settings["schemaVersion"], json!(2));
    }

    #[test]
    fn v1_to_v2_migration_fills_defaults() {
        let mut v1 = json!({
            "schemaVersion": 1,
            "groqApiKey": null,
            "cloudModel": "whisper-large-v3-turbo",
            "transcriptionMode": "cloud",
            "hotkeyMode": "toggle",
            "autostartEnabled": false,
            "micDeviceId": null,
            "localModelPath": null,
            "language": null,
            "hotkey": "ctrl+shift+space"
        });

        migrate_to_v2(&mut v1);

        let settings: AppSettings = serde_json::from_value(v1).unwrap();
        assert_eq!(settings.schema_version, 2);
        assert!(!settings.ai_polish.enabled);
        assert_eq!(settings.ai_polish.model, "llama-3.3-70b-versatile");
        assert_eq!(settings.ai_polish.min_word_count, 10);
        assert!(settings.history_enabled);
        assert!(settings.stats_enabled);
        assert!(!settings.onboarding_complete);
        assert_eq!(settings.last_seen_version, None);
        assert_eq!(settings.update_channel, "stable");
        assert_eq!(settings.theme, "dark");
        assert_eq!(settings.accent_color, "#7c5cff");
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

        if let Some(mut val) = store.get("settings") {
            let version = val
                .get("schemaVersion")
                .and_then(|v| v.as_u64())
                .unwrap_or_else(|| {
                    tracing::warn!(
                        "schemaVersion missing or malformed in stored settings, assuming v1"
                    );
                    1
                });
            if version < 2 {
                migrate_to_v2(&mut val);
                let migrated: AppSettings = serde_json::from_value(val.clone())
                    .map_err(|e| AppError::Settings(e.to_string()))?;
                self.save_settings(&migrated)?;
                return Ok(migrated);
            }
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
