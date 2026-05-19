use crate::db::Db;
use crate::errors::{AppError, Result};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StatsSummary {
    pub sessions: i64,
    pub words: i64,
    pub total_duration_ms: i64,
    pub avg_wpm: f64,
}

#[tauri::command]
pub fn stats_summary(db: State<Db>, range: u32) -> Result<StatsSummary> {
    let conn = db.lock()?;
    let days = match range {
        7 | 30 | 90 => range as i64,
        _ => 7,
    };
    let row: (i64, i64, i64) = conn
        .query_row(
            "SELECT COALESCE(SUM(sessions),0), COALESCE(SUM(words),0), COALESCE(SUM(total_duration_ms),0)
             FROM stats_daily
             WHERE date >= date('now', ?1)",
            [format!("-{} days", days)],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

    let (sessions, words, total_duration_ms) = row;
    let avg_wpm = if total_duration_ms > 0 {
        (words as f64) / (total_duration_ms as f64 / 60_000.0)
    } else {
        0.0
    };

    Ok(StatsSummary {
        sessions,
        words,
        total_duration_ms,
        avg_wpm,
    })
}

pub fn bump_stats(conn: &Connection, words: i64, duration_ms: i64) -> Result<()> {
    conn.execute(
        "INSERT INTO stats_daily (date, sessions, words, total_duration_ms)
         VALUES (date('now'), 1, ?1, ?2)
         ON CONFLICT(date) DO UPDATE SET
             sessions = sessions + 1,
             words = words + excluded.words,
             total_duration_ms = total_duration_ms + excluded.total_duration_ms",
        rusqlite::params![words, duration_ms],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;

    fn in_memory_db() -> Db {
        Db::open_in_memory().expect("in-memory db")
    }

    #[test]
    fn stats_increment() {
        let db = in_memory_db();
        let conn = db.lock().unwrap();
        bump_stats(&conn, 10, 5000).unwrap();
        bump_stats(&conn, 20, 8000).unwrap();
        let row: (i64, i64, i64) = conn
            .query_row(
                "SELECT sessions, words, total_duration_ms FROM stats_daily WHERE date = date('now')",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap();
        assert_eq!(row.0, 2);
        assert_eq!(row.1, 30);
        assert_eq!(row.2, 13000);
    }
}
