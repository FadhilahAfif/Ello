use crate::db::Db;
use crate::errors::{AppError, Result};
use crate::settings::{AppSettings, SettingsManager};
use crate::vocabulary::VocabularyRule;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

const EXPORT_SCHEMA_VERSION: u32 = 4;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ElloConfig {
    pub schema_version: u32,
    pub settings: serde_json::Value,
    pub vocabulary: Vec<VocabularyRule>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    pub schema_version: u32,
    pub settings: AppSettings,
    pub vocabulary: Vec<VocabularyRule>,
}

#[tauri::command]
pub fn export_config(app: AppHandle, db: State<Db>, include_api_key: bool) -> Result<String> {
    let settings = SettingsManager::new(app).get_settings()?;
    let mut settings_value =
        serde_json::to_value(settings).map_err(|e| AppError::Settings(e.to_string()))?;
    if include_api_key {
        if let Some(key) = crate::credentials::get()? {
            settings_value["groqApiKey"] = serde_json::Value::String(key);
        }
    }

    let vocabulary = {
        let conn = db.lock()?;
        let mut stmt = conn
            .prepare(
                "SELECT id, term, replacement, case_sensitive, kind FROM vocabulary ORDER BY id ASC",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        let rows = stmt
            .query_map([], |row| {
                Ok(VocabularyRule {
                    id: row.get(0)?,
                    term: row.get(1)?,
                    replacement: row.get(2)?,
                    case_sensitive: row.get::<_, i64>(3)? != 0,
                    kind: row.get(4)?,
                })
            })
            .map_err(|e| AppError::Database(e.to_string()))?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(|e| AppError::Database(e.to_string()))?;
        rows
    };

    let config = ElloConfig {
        schema_version: EXPORT_SCHEMA_VERSION,
        settings: settings_value,
        vocabulary,
    };

    serde_json::to_string_pretty(&config).map_err(|e| AppError::Settings(e.to_string()))
}

#[tauri::command]
pub fn import_config(json: String) -> Result<ImportPreview> {
    let config: ElloConfig =
        serde_json::from_str(&json).map_err(|e| AppError::Settings(e.to_string()))?;

    if config.schema_version > EXPORT_SCHEMA_VERSION {
        return Err(AppError::Settings(format!(
            "Unsupported config schema version {}; this build supports up to {}",
            config.schema_version, EXPORT_SCHEMA_VERSION
        )));
    }

    let (mut settings, imported_key) = parse_import_settings(config.settings)?;
    settings.groq_api_key_configured =
        imported_key.is_some() || crate::credentials::get()?.is_some();
    settings.cloud_upload_acknowledged = false;

    Ok(ImportPreview {
        schema_version: config.schema_version,
        settings,
        vocabulary: config.vocabulary,
    })
}

#[tauri::command]
pub fn apply_import(app: AppHandle, db: State<Db>, json: String) -> Result<()> {
    let config: ElloConfig =
        serde_json::from_str(&json).map_err(|e| AppError::Settings(e.to_string()))?;

    if config.schema_version > EXPORT_SCHEMA_VERSION {
        return Err(AppError::Settings(format!(
            "Unsupported config schema version {}; this build supports up to {}",
            config.schema_version, EXPORT_SCHEMA_VERSION
        )));
    }

    let (mut settings, imported_key) = parse_import_settings(config.settings)?;
    settings.cloud_upload_acknowledged = false;
    SettingsManager::new(app).save_settings(&settings)?;

    let conn = db.lock()?;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| AppError::Database(e.to_string()))?;

    tx.execute("DELETE FROM vocabulary", [])
        .map_err(|e| AppError::Database(e.to_string()))?;

    for rule in &config.vocabulary {
        let case_int = rule.case_sensitive as i64;
        tx.execute(
            "INSERT INTO vocabulary (term, replacement, case_sensitive, kind) VALUES (?1,?2,?3,?4)",
            rusqlite::params![rule.term, rule.replacement, case_int, rule.kind],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
    }

    tx.commit().map_err(|e| AppError::Database(e.to_string()))?;

    if let Some(key) = imported_key {
        crate::credentials::set(&key)?;
    }

    Ok(())
}

fn parse_import_settings(mut value: serde_json::Value) -> Result<(AppSettings, Option<String>)> {
    let key = value
        .as_object_mut()
        .and_then(|settings| settings.remove("groqApiKey"))
        .and_then(|value| value.as_str().map(str::to_owned))
        .filter(|value| !value.trim().is_empty());
    let settings = serde_json::from_value(value).map_err(|e| AppError::Settings(e.to_string()))?;
    Ok((settings, key))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn imported_secret_is_separated_from_preview_settings() {
        let mut value = serde_json::to_value(AppSettings::default()).unwrap();
        value["groqApiKey"] = json!("gsk_test");

        let (settings, key) = parse_import_settings(value).unwrap();

        assert_eq!(key.as_deref(), Some("gsk_test"));
        assert!(serde_json::to_value(settings)
            .unwrap()
            .get("groqApiKey")
            .is_none());
    }
}
