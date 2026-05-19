use crate::errors::{AppError, Result};
use rusqlite::Connection;
use std::sync::Mutex;

pub mod migrations;

pub struct Db {
    #[allow(dead_code)]
    pub(crate) conn: Mutex<Connection>,
}

impl Db {
    pub fn open(path: &std::path::Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(AppError::Io)?;
        }
        let conn = Connection::open(path).map_err(|e| AppError::Database(e.to_string()))?;
        migrations::run(&conn).map_err(|e| AppError::Database(e.to_string()))?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    #[cfg(test)]
    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory().map_err(|e| AppError::Database(e.to_string()))?;
        migrations::run(&conn).map_err(|e| AppError::Database(e.to_string()))?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }
}
