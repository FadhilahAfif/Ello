use rusqlite::Connection;

const MIGRATIONS: &[&str] = &["CREATE TABLE IF NOT EXISTS vocabulary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        term TEXT NOT NULL,
        replacement TEXT NOT NULL,
        case_sensitive INTEGER NOT NULL DEFAULT 0,
        kind TEXT NOT NULL DEFAULT 'exactWord'
    )"];

pub fn run(conn: &Connection) -> rusqlite::Result<()> {
    let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    let version = usize::try_from(version).unwrap_or(0);
    if version > MIGRATIONS.len() {
        return Err(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_MISMATCH),
            Some(format!(
                "db version {version} is newer than supported {}",
                MIGRATIONS.len()
            )),
        ));
    }
    let pending = &MIGRATIONS[version..];
    for (i, sql) in pending.iter().enumerate() {
        let next_version = (version + i + 1) as i64;
        conn.execute_batch(&format!(
            "BEGIN; {sql}; PRAGMA user_version = {next_version}; COMMIT;"
        ))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_runs_migrations_idempotently() {
        let conn = Connection::open_in_memory().unwrap();
        run(&conn).unwrap();
        run(&conn).unwrap();
        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(version, MIGRATIONS.len() as i64);
    }
}
