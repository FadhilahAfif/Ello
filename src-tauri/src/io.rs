use crate::db::Db;
use crate::errors::{AppError, Result};
use crate::settings::{AppSettings, SettingsManager};
use crate::vocabulary::VocabularyRule;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

const EXPORT_SCHEMA_VERSION: u32 = 3;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ElloConfig {
    pub schema_version: u32,
    pub settings: AppSettings,
    pub vocabulary: Vec<VocabularyRule>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    pub schema_version: u32,
    pub settings: AppSettings,
    pub vocabulary: Vec<VocabularyRule>,
    pub raw: String,
}

#[tauri::command]
pub fn export_config(app: AppHandle, db: State<Db>, include_api_key: bool) -> Result<String> {
    let mut settings = SettingsManager::new(app).get_settings()?;

    if !include_api_key {
        settings.groq_api_key = None;
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
        settings,
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

    Ok(ImportPreview {
        schema_version: config.schema_version,
        settings: config.settings,
        vocabulary: config.vocabulary,
        raw: json,
    })
}

#[tauri::command]
pub fn apply_import(app: AppHandle, db: State<Db>, json: String) -> Result<()> {
    let config: ElloConfig =
        serde_json::from_str(&json).map_err(|e| AppError::Settings(e.to_string()))?;

    SettingsManager::new(app).save_settings(&config.settings)?;

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

    Ok(())
}
