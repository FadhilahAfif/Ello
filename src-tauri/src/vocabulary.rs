use crate::db::Db;
use crate::errors::{AppError, Result};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VocabularyRule {
    pub id: i64,
    pub term: String,
    pub replacement: String,
    pub case_sensitive: bool,
    pub kind: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VocabularyUpsert {
    pub id: Option<i64>,
    pub term: String,
    pub replacement: String,
    pub case_sensitive: bool,
    pub kind: String,
}

#[tauri::command]
pub fn vocabulary_list(db: State<Db>) -> Result<Vec<VocabularyRule>> {
    let conn = db.lock()?;
    let mut stmt = conn
        .prepare(
            "SELECT id, term, replacement, case_sensitive, kind FROM vocabulary ORDER BY id ASC",
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
    let rows = stmt
        .query_map([], map_row)
        .map_err(|e| AppError::Database(e.to_string()))?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(rows)
}

#[tauri::command]
pub fn vocabulary_upsert(db: State<Db>, rule: VocabularyUpsert) -> Result<VocabularyRule> {
    let conn = db.lock()?;
    let case_int = rule.case_sensitive as i64;
    if let Some(id) = rule.id {
        conn.execute(
            "UPDATE vocabulary SET term=?1, replacement=?2, case_sensitive=?3, kind=?4 WHERE id=?5",
            rusqlite::params![rule.term, rule.replacement, case_int, rule.kind, id],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
        conn.query_row(
            "SELECT id, term, replacement, case_sensitive, kind FROM vocabulary WHERE id=?1",
            [id],
            map_row,
        )
        .map_err(|e| AppError::Database(e.to_string()))
    } else {
        conn.execute(
            "INSERT INTO vocabulary (term, replacement, case_sensitive, kind) VALUES (?1,?2,?3,?4)",
            rusqlite::params![rule.term, rule.replacement, case_int, rule.kind],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
        let id = conn.last_insert_rowid();
        conn.query_row(
            "SELECT id, term, replacement, case_sensitive, kind FROM vocabulary WHERE id=?1",
            [id],
            map_row,
        )
        .map_err(|e| AppError::Database(e.to_string()))
    }
}

#[tauri::command]
pub fn vocabulary_delete(db: State<Db>, id: i64) -> Result<()> {
    let conn = db.lock()?;
    conn.execute("DELETE FROM vocabulary WHERE id=?1", [id])
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub fn vocabulary_import_csv(db: State<Db>, csv: String) -> Result<u32> {
    let conn = db.lock()?;
    let mut count = 0u32;
    for line in csv.lines().skip(1) {
        let parts: Vec<&str> = line.splitn(4, ',').collect();
        if parts.len() < 2 {
            continue;
        }
        let term = parts[0].trim().trim_matches('"');
        let replacement = parts[1].trim().trim_matches('"');
        let case_sensitive: i64 = parts
            .get(2)
            .map(|s| s.trim().trim_matches('"'))
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(0);
        let kind = parts
            .get(3)
            .map(|s| s.trim().trim_matches('"'))
            .unwrap_or("exact");
        if term.is_empty() {
            continue;
        }
        conn.execute(
            "INSERT INTO vocabulary (term, replacement, case_sensitive, kind) VALUES (?1,?2,?3,?4)",
            rusqlite::params![term, replacement, case_sensitive, kind],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
        count += 1;
    }
    Ok(count)
}

pub fn apply_rules(text: &str, rules: &[VocabularyRule]) -> String {
    let mut result = text.to_string();
    for rule in rules {
        let term = &rule.term;
        let replacement = &rule.replacement;
        match rule.kind.as_str() {
            "exact" => {
                if rule.case_sensitive {
                    result = replace_word_boundary(&result, term, replacement, true);
                } else {
                    result = replace_word_boundary(&result, term, replacement, false);
                }
            }
            "contains" => {
                if rule.case_sensitive {
                    result = result.replace(term.as_str(), replacement.as_str());
                } else {
                    result = replace_case_insensitive(&result, term, replacement);
                }
            }
            "prefix" => {
                let pattern = term.as_str();
                if rule.case_sensitive {
                    result = replace_prefix(&result, pattern, replacement, true);
                } else {
                    result = replace_prefix(&result, pattern, replacement, false);
                }
            }
            _ => {
                tracing::warn!("Unknown vocabulary rule kind '{}', skipping", rule.kind);
            }
        }
    }
    result
}

fn replace_word_boundary(
    text: &str,
    term: &str,
    replacement: &str,
    case_sensitive: bool,
) -> String {
    let mut result = String::with_capacity(text.len());
    let mut remaining = text;
    loop {
        let search = if case_sensitive {
            remaining.find(term)
        } else {
            remaining
                .to_lowercase()
                .find(&term.to_lowercase())
                .filter(|_| true)
        };
        let Some(pos) = search else {
            result.push_str(remaining);
            break;
        };
        let before = remaining.get(..pos).unwrap_or("");
        let after = remaining.get(pos + term.len()..).unwrap_or("");
        let at_word_start = before
            .chars()
            .last()
            .map(|c| !c.is_alphanumeric() && c != '_')
            .unwrap_or(true);
        let at_word_end = after
            .chars()
            .next()
            .map(|c| !c.is_alphanumeric() && c != '_')
            .unwrap_or(true);
        if at_word_start && at_word_end {
            result.push_str(before);
            result.push_str(replacement);
        } else {
            result.push_str(before);
            result.push_str(&remaining[pos..pos + term.len()]);
        }
        remaining = after;
    }
    result
}

fn replace_case_insensitive(text: &str, term: &str, replacement: &str) -> String {
    let lower_text = text.to_lowercase();
    let lower_term = term.to_lowercase();
    let mut result = String::with_capacity(text.len());
    let mut last = 0;
    let mut start = 0;
    while let Some(pos) = lower_text[start..].find(&lower_term) {
        let abs = start + pos;
        result.push_str(&text[last..abs]);
        result.push_str(replacement);
        last = abs + term.len();
        start = last;
    }
    result.push_str(&text[last..]);
    result
}

fn replace_prefix(text: &str, prefix: &str, replacement: &str, case_sensitive: bool) -> String {
    text.split_whitespace()
        .map(|word| {
            let matches = if case_sensitive {
                word.starts_with(prefix)
            } else {
                word.to_lowercase().starts_with(&prefix.to_lowercase())
            };
            if matches {
                let suffix = &word[prefix.len()..];
                format!("{}{}", replacement, suffix)
            } else {
                word.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn map_row(row: &rusqlite::Row) -> rusqlite::Result<VocabularyRule> {
    Ok(VocabularyRule {
        id: row.get(0)?,
        term: row.get(1)?,
        replacement: row.get(2)?,
        case_sensitive: row.get::<_, i64>(3)? != 0,
        kind: row.get(4)?,
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
    fn vocabulary_roundtrip() {
        let db = in_memory_db();
        let conn = db.lock().unwrap();
        conn.execute(
            "INSERT INTO vocabulary (term, replacement, case_sensitive, kind) VALUES ('gonna','going to',0,'exact')",
            [],
        )
        .unwrap();
        let rule: VocabularyRule = conn
            .query_row(
                "SELECT id, term, replacement, case_sensitive, kind FROM vocabulary WHERE term='gonna'",
                [],
                map_row,
            )
            .unwrap();
        assert_eq!(rule.term, "gonna");
        assert_eq!(rule.replacement, "going to");
        assert!(!rule.case_sensitive);
    }

    #[test]
    fn apply_exact_rule() {
        let rules = vec![VocabularyRule {
            id: 1,
            term: "gonna".to_string(),
            replacement: "going to".to_string(),
            case_sensitive: false,
            kind: "exact".to_string(),
        }];
        let result = apply_rules("I'm gonna do it", &rules);
        assert_eq!(result, "I'm going to do it");
    }

    #[test]
    fn apply_bad_kind_skips() {
        let rules = vec![VocabularyRule {
            id: 1,
            term: "foo".to_string(),
            replacement: "bar".to_string(),
            case_sensitive: false,
            kind: "unknown_kind".to_string(),
        }];
        let result = apply_rules("foo bar", &rules);
        assert_eq!(result, "foo bar");
    }
}
