use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};

use crate::db::Db;
use crate::errors::{AppError, Result};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub enum RuleKind {
    ExactWord,
    Prefix,
    Contains,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct VocabularyRule {
    pub id: Option<i64>,
    pub term: String,
    pub replacement: String,
    pub case_sensitive: bool,
    pub kind: RuleKind,
}

fn build_regex(rule: &VocabularyRule) -> Option<Regex> {
    let escaped = regex::escape(&rule.term);
    let pattern = match rule.kind {
        RuleKind::ExactWord => format!(r"\b{escaped}\b"),
        RuleKind::Prefix => format!(r"\b{escaped}"),
        RuleKind::Contains => escaped,
    };
    match RegexBuilder::new(&pattern)
        .case_insensitive(!rule.case_sensitive)
        .build()
    {
        Ok(re) => Some(re),
        Err(e) => {
            tracing::warn!(
                rule_id = ?rule.id,
                term = %rule.term,
                error = %e,
                "vocabulary rule produced invalid regex, skipping"
            );
            None
        }
    }
}

pub fn apply(text: &str, rules: &[VocabularyRule]) -> String {
    let mut output = text.to_owned();
    for rule in rules {
        if let Some(re) = build_regex(rule) {
            output = re
                .replace_all(&output, rule.replacement.as_str())
                .into_owned();
        }
    }
    output
}

pub fn list(db: &Db) -> Result<Vec<VocabularyRule>> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut stmt = conn
        .prepare("SELECT id, term, replacement, case_sensitive, kind FROM vocabulary ORDER BY id")
        .map_err(|e| AppError::Database(e.to_string()))?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, bool>(3)?,
                row.get::<_, String>(4)?,
            ))
        })
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut rules = Vec::new();
    for row in rows {
        let (id, term, replacement, case_sensitive, kind_str) =
            row.map_err(|e| AppError::Database(e.to_string()))?;
        let kind = parse_kind(&kind_str);
        rules.push(VocabularyRule {
            id: Some(id),
            term,
            replacement,
            case_sensitive,
            kind,
        });
    }
    Ok(rules)
}

pub fn upsert(db: &Db, rule: VocabularyRule) -> Result<VocabularyRule> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let kind_str = kind_to_str(&rule.kind);
    match rule.id {
        None => {
            conn.execute(
                "INSERT INTO vocabulary (term, replacement, case_sensitive, kind) VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![rule.term, rule.replacement, rule.case_sensitive, kind_str],
            ).map_err(|e| AppError::Database(e.to_string()))?;
            let id = conn.last_insert_rowid();
            Ok(VocabularyRule {
                id: Some(id),
                ..rule
            })
        }
        Some(id) => {
            let changed = conn.execute(
                "UPDATE vocabulary SET term=?1, replacement=?2, case_sensitive=?3, kind=?4 WHERE id=?5",
                rusqlite::params![rule.term, rule.replacement, rule.case_sensitive, kind_str, id],
            ).map_err(|e| AppError::Database(e.to_string()))?;
            if changed == 0 {
                return Err(AppError::Database(format!(
                    "vocabulary rule {id} not found"
                )));
            }
            Ok(rule)
        }
    }
}

pub fn delete(db: &Db, id: i64) -> Result<()> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    conn.execute("DELETE FROM vocabulary WHERE id=?1", rusqlite::params![id])
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

pub fn import_csv(db: &Db, csv_text: &str) -> Result<usize> {
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(true)
        .from_reader(csv_text.as_bytes());
    let headers = rdr
        .headers()
        .map_err(|e| AppError::Database(e.to_string()))?
        .clone();
    let col = |name: &str| headers.iter().position(|h| h.eq_ignore_ascii_case(name));
    let term_idx = col("term");
    let repl_idx = col("replacement");
    let kind_idx = col("kind");
    let cs_idx = col("caseSensitive");

    let mut valid_rows: Vec<(String, String, bool, String)> = Vec::new();
    for (i, result) in rdr.records().enumerate() {
        let record = match result {
            Ok(r) => r,
            Err(e) => {
                tracing::warn!(row = i + 2, error = %e, "csv parse error, skipping row");
                continue;
            }
        };
        let get = |idx: Option<usize>| {
            idx.and_then(|i| record.get(i))
                .unwrap_or("")
                .trim()
                .to_owned()
        };
        let term = get(term_idx);
        let replacement = get(repl_idx);
        if term.is_empty() {
            tracing::warn!(row = i + 2, "csv row missing term, skipping");
            continue;
        }
        let kind_str = get(kind_idx);
        let kind_str = if kind_str.is_empty() {
            tracing::warn!(row = i + 2, "csv row missing kind, defaulting to exactWord");
            "exactWord".to_owned()
        } else {
            kind_to_str(&parse_kind(&kind_str)).to_owned()
        };
        let cs_str = get(cs_idx).to_lowercase();
        let case_sensitive = matches!(cs_str.as_str(), "true" | "1");
        valid_rows.push((term, replacement, case_sensitive, kind_str));
    }

    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    conn.execute_batch("BEGIN")
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut count = 0usize;
    for (term, replacement, case_sensitive, kind_str) in &valid_rows {
        match conn.execute(
            "INSERT INTO vocabulary (term, replacement, case_sensitive, kind) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![term, replacement, case_sensitive, kind_str],
        ) {
            Ok(_) => count += 1,
            Err(e) => tracing::warn!(error = %e, "failed to insert csv row, skipping"),
        }
    }
    conn.execute_batch("COMMIT")
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(count)
}

fn parse_kind(s: &str) -> RuleKind {
    match s.to_lowercase().as_str() {
        "prefix" => RuleKind::Prefix,
        "contains" => RuleKind::Contains,
        "exactword" => RuleKind::ExactWord,
        _ => {
            tracing::warn!(
                kind = s,
                "unknown vocabulary rule kind, defaulting to exactWord"
            );
            RuleKind::ExactWord
        }
    }
}

fn kind_to_str(k: &RuleKind) -> &'static str {
    match k {
        RuleKind::ExactWord => "exactWord",
        RuleKind::Prefix => "prefix",
        RuleKind::Contains => "contains",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rule(
        id: Option<i64>,
        term: &str,
        replacement: &str,
        case_sensitive: bool,
        kind: RuleKind,
    ) -> VocabularyRule {
        VocabularyRule {
            id,
            term: term.to_owned(),
            replacement: replacement.to_owned(),
            case_sensitive,
            kind,
        }
    }

    #[test]
    fn exact_word_matches_whole_word() {
        let rules = [rule(Some(1), "foo", "bar", true, RuleKind::ExactWord)];
        assert_eq!(apply("foo baz", &rules), "bar baz");
    }

    #[test]
    fn exact_word_does_not_match_substring() {
        let rules = [rule(Some(1), "foo", "bar", true, RuleKind::ExactWord)];
        assert_eq!(apply("foobar", &rules), "foobar");
    }

    #[test]
    fn prefix_matches_start_of_word() {
        let rules = [rule(Some(1), "pre", "POST", true, RuleKind::Prefix)];
        assert_eq!(apply("prefix test", &rules), "POSTfix test");
    }

    #[test]
    fn contains_matches_substring() {
        let rules = [rule(Some(1), "oo", "00", true, RuleKind::Contains)];
        assert_eq!(apply("foobar", &rules), "f00bar");
    }

    #[test]
    fn case_insensitive_match() {
        let rules = [rule(Some(1), "FOO", "bar", false, RuleKind::ExactWord)];
        assert_eq!(apply("foo baz", &rules), "bar baz");
    }

    #[test]
    fn bad_regex_rule_is_skipped() {
        let bad = VocabularyRule {
            id: Some(99),
            term: "(".to_owned(),
            replacement: "x".to_owned(),
            case_sensitive: true,
            kind: RuleKind::Contains,
        };
        let rules = [bad, rule(Some(2), "foo", "bar", true, RuleKind::ExactWord)];
        assert_eq!(apply("foo", &rules), "bar");
    }

    #[test]
    fn roundtrip_insert_list_delete() {
        let db = crate::db::Db::open_in_memory().unwrap();
        let inserted =
            upsert(&db, rule(None, "hello", "world", true, RuleKind::ExactWord)).unwrap();
        assert!(inserted.id.unwrap() > 0);

        let rows = list(&db).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].term, "hello");
        assert_eq!(rows[0].replacement, "world");

        delete(&db, inserted.id.unwrap()).unwrap();
        let rows = list(&db).unwrap();
        assert!(rows.is_empty());
    }

    #[test]
    fn upsert_update_path() {
        let db = crate::db::Db::open_in_memory().unwrap();
        let inserted = upsert(
            &db,
            VocabularyRule {
                id: None,
                term: "foo".into(),
                replacement: "bar".into(),
                case_sensitive: true,
                kind: RuleKind::ExactWord,
            },
        )
        .unwrap();
        let id = inserted.id.unwrap();
        let updated = upsert(
            &db,
            VocabularyRule {
                id: Some(id),
                term: "foo".into(),
                replacement: "baz".into(),
                case_sensitive: true,
                kind: RuleKind::ExactWord,
            },
        )
        .unwrap();
        assert_eq!(updated.replacement, "baz");
        let rules = list(&db).unwrap();
        assert_eq!(rules[0].replacement, "baz");
    }

    #[test]
    fn csv_import_skips_bad_rows() {
        let db = crate::db::Db::open_in_memory().unwrap();
        let csv = "term,replacement,kind,caseSensitive\nhello,world,exactWord,false\n,missing_term,exactWord,false\n";
        let count = import_csv(&db, csv).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn csv_import_defaults_kind() {
        let db = crate::db::Db::open_in_memory().unwrap();
        let csv = "term,replacement,caseSensitive\nhello,world,false\n";
        let count = import_csv(&db, csv).unwrap();
        assert_eq!(count, 1);
        let rows = list(&db).unwrap();
        assert_eq!(rows.len(), 1);
        assert!(matches!(rows[0].kind, RuleKind::ExactWord));
    }
}
