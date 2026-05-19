use crate::errors::{AppError, Result};
use crate::settings::AiPolishSettings;
use reqwest::blocking::Client;
use serde::Deserialize;
use std::sync::OnceLock;
use std::time::Duration;

static CLIENT: OnceLock<Client> = OnceLock::new();

fn client() -> &'static Client {
    CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .expect("failed to build reqwest client for polish")
    })
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: Message,
}

#[derive(Deserialize)]
struct Message {
    content: String,
}

pub fn run(text: &str, settings: &AiPolishSettings, api_key: &str) -> Result<String> {
    if !settings.enabled {
        return Ok(text.to_string());
    }
    if text.trim().is_empty() {
        return Ok(text.to_string());
    }
    let word_count = text.split_whitespace().count();
    if word_count < settings.min_word_count as usize {
        return Ok(text.to_string());
    }

    let body = serde_json::json!({
        "model": settings.model,
        "messages": [
            { "role": "system", "content": settings.prompt },
            { "role": "user", "content": text }
        ],
        "temperature": 0.3
    });

    let resp = client()
        .post("https://api.groq.com/openai/v1/chat/completions")
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .map_err(|e| {
            tracing::debug!("Polish network error: {}", e);
            AppError::Transcription("polish_network".to_string())
        })?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        tracing::debug!("Polish HTTP error: {}", status);
        return Err(AppError::Transcription(format!("polish_http_{}", status)));
    }

    let parsed: ChatResponse = resp.json().map_err(|e| {
        tracing::debug!("Polish parse error: {}", e);
        AppError::Transcription("polish_parse".to_string())
    })?;

    let polished = parsed
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content)
        .unwrap_or_else(|| text.to_string());

    Ok(polished)
}

#[tauri::command]
pub fn polish_test(app: tauri::AppHandle, text: String) -> Result<String> {
    use crate::settings::SettingsManager;
    let settings = SettingsManager::new(app).get_settings()?;
    let api_key = settings
        .groq_api_key
        .ok_or_else(|| AppError::Transcription("Groq API key not set".to_string()))?;
    run(&text, &settings.ai_polish, &api_key)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::AiPolishSettings;

    fn disabled_settings() -> AiPolishSettings {
        AiPolishSettings {
            enabled: false,
            model: "llama-3.3-70b-versatile".to_string(),
            prompt: "Fix grammar.".to_string(),
            min_word_count: 10,
        }
    }

    fn enabled_settings() -> AiPolishSettings {
        AiPolishSettings {
            enabled: true,
            model: "llama-3.3-70b-versatile".to_string(),
            prompt: "Fix grammar.".to_string(),
            min_word_count: 10,
        }
    }

    #[test]
    fn skips_when_disabled() {
        let text = "hello world foo bar baz qux quux corge grault garply";
        let result = run(text, &disabled_settings(), "fake-key").unwrap();
        assert_eq!(result, text);
    }

    #[test]
    fn skips_when_empty() {
        let result = run("", &enabled_settings(), "fake-key").unwrap();
        assert_eq!(result, "");
    }

    #[test]
    fn skips_when_below_min_word_count() {
        let result = run("hello world", &enabled_settings(), "fake-key").unwrap();
        assert_eq!(result, "hello world");
    }

    #[test]
    fn parses_response_shape() {
        let json = r#"{"choices":[{"message":{"content":"Fixed text."}}]}"#;
        let parsed: ChatResponse = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.choices[0].message.content, "Fixed text.");
    }

    #[test]
    #[ignore]
    fn integration_groq_polish() {
        let key = std::env::var("GROQ_API_KEY").expect("GROQ_API_KEY not set");
        let settings = enabled_settings();
        let text =
            "um so basically I was gonna like go to the store you know and uh pick up some stuff";
        let result = run(text, &settings, &key).unwrap();
        assert!(!result.is_empty());
        assert_ne!(result, text);
    }
}
