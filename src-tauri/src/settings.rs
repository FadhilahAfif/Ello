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

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum OverlayStyle {
    #[default]
    Card,
    Dot,
    Pill,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum OverlayColor {
    #[default]
    Accent,
    Amber,
    Cyan,
    Green,
    White,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum OverlayPosition {
    TopLeft,
    #[default]
    TopCenter,
    TopRight,
    BottomLeft,
    BottomCenter,
    BottomRight,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OverlaySettings {
    pub style: OverlayStyle,
    pub color: OverlayColor,
    pub position: OverlayPosition,
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
    // v2 fields
    pub theme: String,
    pub accent_color: String,
    pub ai_polish: AiPolishSettings,
    pub history_enabled: bool,
    pub stats_enabled: bool,
    pub onboarding_complete: bool,
    pub last_seen_version: Option<String>,
    pub update_channel: String,
    // v3 fields
    #[serde(default)]
    pub overlay: OverlaySettings,
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
            schema_version: 3,
            groq_api_key: None,
            cloud_model: "whisper-large-v3-turbo".to_string(),
            transcription_mode: TranscriptionMode::default(),
            hotkey_mode: HotkeyMode::default(),
            autostart_enabled: false,
            mic_device_id: None,
            local_model_path: None,
            language: None,
            hotkey: crate::hotkey::DEFAULT_HOTKEY.to_string(),
            theme: "dark".to_string(),
            accent_color: "#7c5cff".to_string(),
            ai_polish: AiPolishSettings::default(),
            history_enabled: true,
            stats_enabled: true,
            onboarding_complete: false,
            last_seen_version: None,
            update_channel: "stable".to_string(),
            overlay: OverlaySettings::default(),
        }
    }
}

fn migrate_v1_to_v2(mut settings: AppSettings) -> AppSettings {
    if settings.schema_version < 2 {
        let defaults = AppSettings::default();
        settings.schema_version = 2;
        settings.theme = defaults.theme;
        settings.accent_color = defaults.accent_color;
        settings.ai_polish = defaults.ai_polish;
        settings.history_enabled = defaults.history_enabled;
        settings.stats_enabled = defaults.stats_enabled;
        settings.onboarding_complete = defaults.onboarding_complete;
        settings.last_seen_version = defaults.last_seen_version;
        settings.update_channel = defaults.update_channel;
    }
    settings
}

fn migrate_v2_to_v3(mut settings: AppSettings) -> AppSettings {
    if settings.schema_version < 3 {
        settings.schema_version = 3;
        // overlay already populated by #[serde(default)]; bump version only
    }
    settings
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
            let raw: serde_json::Value = val;
            let version = raw
                .get("schemaVersion")
                .and_then(|v| v.as_u64())
                .unwrap_or(1) as u16;

            // Deserialize with missing-field defaults via a helper
            let settings: AppSettings = if version < 2 {
                let partial: AppSettingsV1 =
                    serde_json::from_value(raw).map_err(|e| AppError::Settings(e.to_string()))?;
                let migrated = migrate_v1_to_v2(partial.into());
                migrate_v2_to_v3(migrated)
            } else if version < 3 {
                let s: AppSettings =
                    serde_json::from_value(raw).map_err(|e| AppError::Settings(e.to_string()))?;
                migrate_v2_to_v3(s)
            } else {
                serde_json::from_value(raw).map_err(|e| AppError::Settings(e.to_string()))?
            };
            Ok(settings)
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

/// Subset of fields present in schema v1 — used only for migration deserialization.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppSettingsV1 {
    #[serde(default = "default_schema_version_1")]
    schema_version: u16,
    groq_api_key: Option<String>,
    #[serde(default = "default_cloud_model")]
    cloud_model: String,
    #[serde(default)]
    transcription_mode: TranscriptionMode,
    #[serde(default)]
    hotkey_mode: HotkeyMode,
    #[serde(default)]
    autostart_enabled: bool,
    mic_device_id: Option<String>,
    local_model_path: Option<String>,
    language: Option<String>,
    #[serde(default = "default_hotkey")]
    hotkey: String,
}

fn default_schema_version_1() -> u16 {
    1
}
fn default_cloud_model() -> String {
    "whisper-large-v3-turbo".to_string()
}
fn default_hotkey() -> String {
    crate::hotkey::DEFAULT_HOTKEY.to_string()
}

impl From<AppSettingsV1> for AppSettings {
    fn from(v1: AppSettingsV1) -> Self {
        let defaults = AppSettings::default();
        AppSettings {
            schema_version: v1.schema_version,
            groq_api_key: v1.groq_api_key,
            cloud_model: v1.cloud_model,
            transcription_mode: v1.transcription_mode,
            hotkey_mode: v1.hotkey_mode,
            autostart_enabled: v1.autostart_enabled,
            mic_device_id: v1.mic_device_id,
            local_model_path: v1.local_model_path,
            language: v1.language,
            hotkey: v1.hotkey,
            theme: defaults.theme,
            accent_color: defaults.accent_color,
            ai_polish: defaults.ai_polish,
            history_enabled: defaults.history_enabled,
            stats_enabled: defaults.stats_enabled,
            onboarding_complete: defaults.onboarding_complete,
            last_seen_version: defaults.last_seen_version,
            update_channel: defaults.update_channel,
            overlay: defaults.overlay,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn default_settings_schema_v2() {
        let settings = serde_json::to_value(AppSettings::default()).unwrap();
        assert_eq!(settings["schemaVersion"], json!(3));
        assert_eq!(settings["historyEnabled"], json!(true));
        assert_eq!(settings["statsEnabled"], json!(true));
        assert_eq!(settings["onboardingComplete"], json!(false));
        assert_eq!(settings["theme"], json!("dark"));
        assert_eq!(settings["updateChannel"], json!("stable"));
    }

    #[test]
    fn v1_blob_migrates_to_v2() {
        let v1_blob = json!({
            "schemaVersion": 1,
            "groqApiKey": null,
            "cloudModel": "whisper-large-v3-turbo",
            "transcriptionMode": "cloud",
            "hotkeyMode": "toggle",
            "autostartEnabled": false,
            "micDeviceId": null,
            "localModelPath": null,
            "language": null,
            "hotkey": "Alt+Shift+R"
        });

        let v1: AppSettingsV1 = serde_json::from_value(v1_blob).unwrap();
        let migrated = migrate_v1_to_v2(v1.into());

        assert_eq!(migrated.schema_version, 2);
        assert_eq!(migrated.theme, "dark");
        assert_eq!(migrated.accent_color, "#7c5cff");
        assert!(migrated.history_enabled);
        assert!(migrated.stats_enabled);
        assert!(!migrated.onboarding_complete);
        assert_eq!(migrated.update_channel, "stable");
        assert!(!migrated.ai_polish.enabled);
        assert_eq!(migrated.ai_polish.min_word_count, 10);
        // v1 fields preserved
        assert_eq!(migrated.cloud_model, "whisper-large-v3-turbo");
        assert_eq!(migrated.hotkey, "Alt+Shift+R");
    }

    #[test]
    fn default_settings_schema_v3() {
        let settings = serde_json::to_value(AppSettings::default()).unwrap();
        assert_eq!(settings["schemaVersion"], json!(3));
        assert_eq!(settings["overlay"]["style"], json!("card"));
        assert_eq!(settings["overlay"]["color"], json!("accent"));
        assert_eq!(settings["overlay"]["position"], json!("topCenter"));
    }

    #[test]
    fn v2_blob_migrates_to_v3() {
        let v2_blob = json!({
            "schemaVersion": 2,
            "groqApiKey": null,
            "cloudModel": "whisper-large-v3-turbo",
            "transcriptionMode": "cloud",
            "hotkeyMode": "toggle",
            "autostartEnabled": false,
            "micDeviceId": null,
            "localModelPath": null,
            "language": null,
            "hotkey": "Alt+Shift+D",
            "theme": "dark",
            "accentColor": "#e8a020",
            "aiPolish": {
                "enabled": false,
                "model": "llama-3.3-70b-versatile",
                "prompt": "Remove filler words and fix grammar without changing meaning.",
                "minWordCount": 10
            },
            "historyEnabled": true,
            "statsEnabled": true,
            "onboardingComplete": false,
            "lastSeenVersion": null,
            "updateChannel": "stable"
        });
        let s: AppSettings = serde_json::from_value(v2_blob).unwrap();
        let migrated = migrate_v2_to_v3(s);
        assert_eq!(migrated.schema_version, 3);
        assert_eq!(migrated.overlay.style, OverlayStyle::Card);
        assert_eq!(migrated.overlay.color, OverlayColor::Accent);
        assert_eq!(migrated.overlay.position, OverlayPosition::TopCenter);
        assert_eq!(migrated.accent_color, "#e8a020");
    }
}
