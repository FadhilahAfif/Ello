use crate::db::Db;
use crate::errors::{AppError, Result};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptRow {
    pub id: i64,
    pub text: String,
    pub created_at: String,
    pub mode: String,
    pub model: String,
    pub duration_ms: i64,
    pub word_count: i64,
}

#[tauri::command]
pub fn history_list(
    db: State<Db>,
    query: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<TranscriptRow>> {
    let conn = db.lock()?;
    let limit = limit.unwrap_or(50).min(200);
    let offset = offset.unwrap_or(0);

    let rows: Vec<TranscriptRow> = if let Some(q) = query.filter(|s| !s.trim().is_empty()) {
        let fts_query = format!("{}*", q.trim());
        let mut stmt = conn
            .prepare(
                "SELECT t.id, t.text, t.created_at, t.mode, t.model, t.duration_ms, t.word_count
                 FROM transcripts t
                 JOIN transcripts_fts f ON f.rowid = t.id
                 WHERE transcripts_fts MATCH ?1
                 ORDER BY t.created_at DESC
                 LIMIT ?2 OFFSET ?3",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        let collected: std::result::Result<Vec<_>, _> = stmt
            .query_map([fts_query, limit.to_string(), offset.to_string()], map_row)
            .map_err(|e| AppError::Database(e.to_string()))?
            .collect();
        collected.map_err(|e: rusqlite::Error| AppError::Database(e.to_string()))?
    } else {
        let mut stmt = conn
            .prepare(
                "SELECT id, text, created_at, mode, model, duration_ms, word_count
                 FROM transcripts
                 ORDER BY created_at DESC
                 LIMIT ?1 OFFSET ?2",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        let collected: std::result::Result<Vec<_>, _> = stmt
            .query_map([limit, offset], map_row)
            .map_err(|e| AppError::Database(e.to_string()))?
            .collect();
        collected.map_err(|e: rusqlite::Error| AppError::Database(e.to_string()))?
    };

    Ok(rows)
}

#[tauri::command]
pub fn history_get(db: State<Db>, id: i64) -> Result<TranscriptRow> {
    let conn = db.lock()?;
    conn.query_row(
        "SELECT id, text, created_at, mode, model, duration_ms, word_count
         FROM transcripts WHERE id = ?1",
        [id],
        map_row,
    )
    .map_err(|e| AppError::Database(e.to_string()))
}

#[tauri::command]
pub fn history_delete(db: State<Db>, id: i64) -> Result<()> {
    let conn = db.lock()?;
    conn.execute("DELETE FROM transcripts WHERE id = ?1", [id])
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub fn history_clear(db: State<Db>) -> Result<()> {
    let conn = db.lock()?;
    conn.execute_batch("DELETE FROM transcripts; INSERT INTO transcripts_fts(transcripts_fts) VALUES ('rebuild');")
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExportFormat(pub String);

#[tauri::command]
pub fn history_export(db: State<Db>, ids: Vec<i64>, format: String) -> Result<String> {
    let conn = db.lock()?;
    let mut rows: Vec<TranscriptRow> = Vec::new();
    for id in &ids {
        let row = conn
            .query_row(
                "SELECT id, text, created_at, mode, model, duration_ms, word_count
                 FROM transcripts WHERE id = ?1",
                [id],
                map_row,
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        rows.push(row);
    }

    let output = match format.as_str() {
        "json" => serde_json::to_string_pretty(&rows)
            .map_err(|e| AppError::Database(e.to_string()))?,
        "markdown" => rows
            .iter()
            .map(|r| format!("## {}\n\n{}\n", r.created_at, r.text))
            .collect::<Vec<_>>()
            .join("\n---\n\n"),
        _ => rows
            .iter()
            .map(|r| format!("[{}]\n{}", r.created_at, r.text))
            .collect::<Vec<_>>()
            .join("\n\n"),
    };

    Ok(output)
}

pub fn insert_transcript(
    conn: &rusqlite::Connection,
    text: &str,
    mode: &str,
    model: &str,
    duration_ms: i64,
) -> Result<i64> {
    let word_count = text.split_whitespace().count() as i64;
    conn.execute(
        "INSERT INTO transcripts (text, mode, model, duration_ms, word_count)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![text, mode, model, duration_ms, word_count],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(conn.last_insert_rowid())
}

fn map_row(row: &rusqlite::Row) -> rusqlite::Result<TranscriptRow> {
    Ok(TranscriptRow {
        id: row.get(0)?,
        text: row.get(1)?,
        created_at: row.get(2)?,
        mode: row.get(3)?,
        model: row.get(4)?,
        duration_ms: row.get(5)?,
        word_count: row.get(6)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;


    fn in_memory_db() -> Db {
        Db::open_in_memory().expect("in-memory db")
    }

    #[test]
    fn insert_and_list() {
        let db = in_memory_db();
        let conn = db.lock().unwrap();
        insert_transcript(&conn, "hello world", "cloud", "whisper-large-v3-turbo", 1000).unwrap();
        drop(conn);

        let conn = db.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT id, text, created_at, mode, model, duration_ms, word_count FROM transcripts")
            .unwrap();
        let rows: Vec<TranscriptRow> = stmt
            .query_map([], map_row)
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].text, "hello world");
        assert_eq!(rows[0].word_count, 2);
    }

    #[test]
    fn fts_search() {
        let db = in_memory_db();
        let conn = db.lock().unwrap();
        insert_transcript(&conn, "the quick brown fox", "cloud", "model", 500).unwrap();
        insert_transcript(&conn, "lazy dog sleeping", "cloud", "model", 500).unwrap();
        drop(conn);

        let conn = db.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT t.id, t.text, t.created_at, t.mode, t.model, t.duration_ms, t.word_count
                 FROM transcripts t
                 JOIN transcripts_fts f ON f.rowid = t.id
                 WHERE transcripts_fts MATCH 'quick*'
                 ORDER BY t.created_at DESC",
            )
            .unwrap();
        let rows: Vec<TranscriptRow> = stmt
            .query_map([], map_row)
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        assert_eq!(rows.len(), 1);
        assert!(rows[0].text.contains("quick"));
    }
}
