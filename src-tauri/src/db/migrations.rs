use rusqlite::Connection;
use crate::errors::{AppError, Result};

pub fn run(conn: &Connection) -> Result<()> {
    let version = get_version(conn)?;
    for (i, migration) in MIGRATIONS.iter().enumerate() {
        let target = (i + 1) as u32;
        if version < target {
            conn.execute_batch(migration)
                .map_err(|e| AppError::Database(format!("Migration {} failed: {}", target, e)))?;
            set_version(conn, target)?;
        }
    }
    Ok(())
}

fn get_version(conn: &Connection) -> Result<u32> {
    conn.execute_batch("CREATE TABLE IF NOT EXISTS _schema_version (version INTEGER NOT NULL)")
        .map_err(|e| AppError::Database(e.to_string()))?;
    let v: u32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM _schema_version",
            [],
            |row| row.get(0),
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(v)
}

fn set_version(conn: &Connection, version: u32) -> Result<()> {
    conn.execute(
        "INSERT INTO _schema_version (version) VALUES (?1)",
        [version],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

const MIGRATIONS: &[&str] = &[
    // Migration 1: initial schema
    "
    CREATE TABLE IF NOT EXISTS transcripts (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        text        TEXT    NOT NULL,
        created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        mode        TEXT    NOT NULL,
        model       TEXT    NOT NULL,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        word_count  INTEGER NOT NULL DEFAULT 0
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS transcripts_fts USING fts5(
        text,
        content='transcripts',
        content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS transcripts_ai AFTER INSERT ON transcripts BEGIN
        INSERT INTO transcripts_fts(rowid, text) VALUES (new.id, new.text);
    END;

    CREATE TRIGGER IF NOT EXISTS transcripts_ad AFTER DELETE ON transcripts BEGIN
        INSERT INTO transcripts_fts(transcripts_fts, rowid, text) VALUES ('delete', old.id, old.text);
    END;

    CREATE TRIGGER IF NOT EXISTS transcripts_au AFTER UPDATE ON transcripts BEGIN
        INSERT INTO transcripts_fts(transcripts_fts, rowid, text) VALUES ('delete', old.id, old.text);
        INSERT INTO transcripts_fts(rowid, text) VALUES (new.id, new.text);
    END;

    CREATE TABLE IF NOT EXISTS vocabulary (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        term           TEXT    NOT NULL,
        replacement    TEXT    NOT NULL,
        case_sensitive INTEGER NOT NULL DEFAULT 0,
        kind           TEXT    NOT NULL DEFAULT 'exact'
    );

    CREATE TABLE IF NOT EXISTS stats_daily (
        date             TEXT    PRIMARY KEY,
        sessions         INTEGER NOT NULL DEFAULT 0,
        words            INTEGER NOT NULL DEFAULT 0,
        total_duration_ms INTEGER NOT NULL DEFAULT 0
    );
    ",
];
