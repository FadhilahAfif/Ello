use crate::errors::{AppError, Result};
use crate::settings::AiPolishSettings;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use std::time::Duration;

const GROQ_CHAT_URL: &str = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_SECS: u64 = 10;

static HTTP_CLIENT: OnceLock<reqwest::blocking::Client> = OnceLock::new();

fn get_client() -> Result<&'static reqwest::blocking::Client> {
    Ok(HTTP_CLIENT.get_or_init(|| {
        reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(TIMEOUT_SECS))
            .build()
            .expect("failed to build HTTP client")
    }))
}

#[derive(Serialize)]
struct ChatRequest<'a> {
    model: &'a str,
    messages: Vec<Message<'a>>,
}

#[derive(Serialize)]
struct Message<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: ResponseMessage,
}

#[derive(Deserialize)]
struct ResponseMessage {
    content: String,
}

pub fn run(text: &str, settings: &AiPolishSettings, api_key: &str) -> Result<String> {
    if !settings.enabled {
        return Ok(text.to_owned());
    }
    let word_count = text.split_whitespace().count();
    if word_count < settings.min_word_count as usize {
        return Ok(text.to_owned());
    }

    let client = get_client()?;

    let body = ChatRequest {
        model: &settings.model,
        messages: vec![
            Message {
                role: "system",
                content: &settings.prompt,
            },
            Message {
                role: "user",
                content: text,
            },
        ],
    };

    let resp = client
        .post(GROQ_CHAT_URL)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .map_err(|e| AppError::Polish(e.to_string()))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().unwrap_or_default();
        tracing::debug!(status = %status, "Groq API error response body: {body}");
        return Err(AppError::Polish(format!("Groq API returned {status}")));
    }

    let chat: ChatResponse = resp.json().map_err(|e| AppError::Polish(e.to_string()))?;
    let polished = chat
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content)
        .unwrap_or_else(|| text.to_owned());

    Ok(polished)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::AiPolishSettings;

    fn settings(enabled: bool, min_word_count: u32) -> AiPolishSettings {
        AiPolishSettings {
            enabled,
            model: "llama-3.3-70b-versatile".to_string(),
            prompt: "Fix grammar.".to_string(),
            min_word_count,
        }
    }

    #[test]
    fn disabled_returns_input_unchanged() {
        let s = settings(false, 5);
        assert_eq!(run("hello world", &s, "fake_key").unwrap(), "hello world");
    }

    #[test]
    fn below_min_word_count_returns_input_unchanged() {
        let s = settings(true, 10);
        assert_eq!(
            run("one two three four", &s, "fake_key").unwrap(),
            "one two three four"
        );
    }

    #[test]
    fn exactly_min_word_count_attempts_api_call() {
        // word_count == min_word_count should NOT be skipped.
        // With a fake key the call will error, proving we didn't return early.
        let s = settings(true, 4);
        let result = run("one two three four", &s, "fake_key");
        assert!(
            result.is_err(),
            "expected network error, not a silent pass-through"
        );
    }

    #[test]
    #[ignore = "requires GROQ_API_KEY"]
    fn integration_real_call_returns_polished_text() {
        let key = std::env::var("GROQ_API_KEY").unwrap();
        let s = settings(true, 1);
        let result = run("um so like I was gonna go to the store", &s, &key).unwrap();
        assert!(!result.is_empty());
        assert_ne!(result, "um so like I was gonna go to the store");
    }
}
