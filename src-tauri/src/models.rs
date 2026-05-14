use crate::errors::{AppError, Result};
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

// ── Manifest ─────────────────────────────────────────────────────────────────

pub struct ModelInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub filename: &'static str,
    pub url: &'static str,
    pub size_bytes: u64,
    pub sha1: &'static str,
}

pub const MODELS: &[ModelInfo] = &[
    ModelInfo {
        id: "tiny",
        name: "Whisper Tiny",
        filename: "ggml-tiny.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
        size_bytes: 77_704_715,
        sha1: "bd577a113a864445d4c299885e0cb97d4ba92b5f",
    },
    ModelInfo {
        id: "base",
        name: "Whisper Base",
        filename: "ggml-base.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
        size_bytes: 147_951_465,
        sha1: "465707469ff3a37a2b9b8d8f89f2f99de7299dac",
    },
    ModelInfo {
        id: "small",
        name: "Whisper Small (recommended)",
        filename: "ggml-small.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
        size_bytes: 487_601_967,
        sha1: "55356645c2b361a969dfd0ef2c5a50d530afd8d5",
    },
    ModelInfo {
        id: "medium",
        name: "Whisper Medium",
        filename: "ggml-medium.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
        size_bytes: 1_533_763_059,
        sha1: "fd9727b6e1217c2f614f9b698455c4ffd82463b4",
    },
    ModelInfo {
        id: "large-v3-turbo",
        name: "Whisper Large v3 Turbo",
        filename: "ggml-large-v3-turbo.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin",
        size_bytes: 1_622_088_736,
        sha1: "4af2b29d7ec73d781377bfd1758ca957a807e941",
    },
];

pub fn find_model(id: &str) -> Option<&'static ModelInfo> {
    MODELS.iter().find(|m| m.id == id)
}

// ── Download state ────────────────────────────────────────────────────────────

pub struct DownloadState {
    pub cancels: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
}

impl Default for DownloadState {
    fn default() -> Self {
        Self {
            cancels: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfoDto {
    pub id: String,
    pub name: String,
    pub filename: String,
    pub size_bytes: u64,
    pub sha1: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelValidationResult {
    pub valid: bool,
    pub error: Option<String>,
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_model_manifest() -> Vec<ModelInfoDto> {
    MODELS
        .iter()
        .map(|m| ModelInfoDto {
            id: m.id.to_string(),
            name: m.name.to_string(),
            filename: m.filename.to_string(),
            size_bytes: m.size_bytes,
            sha1: m.sha1.to_string(),
        })
        .collect()
}

#[tauri::command]
pub fn download_model(
    app: AppHandle,
    state: State<DownloadState>,
    id: String,
    dest_dir: String,
) -> Result<()> {
    let model = find_model(&id)
        .ok_or_else(|| AppError::Model(format!("Unknown model id: {}", id)))?;

    let cancel = Arc::new(AtomicBool::new(false));
    state
        .cancels
        .lock()
        .map_err(|_| AppError::Model("Lock poisoned".into()))?
        .insert(id.clone(), Arc::clone(&cancel));

    let url = model.url.to_string();
    let filename = model.filename.to_string();
    let sha1_expected = model.sha1.to_string();
    let size_bytes = model.size_bytes;
    let dest_dir = PathBuf::from(dest_dir);
    let model_id = id.clone();
    let cancels = Arc::clone(&state.cancels);

    std::thread::spawn(move || {
        let result = run_download(
            &app,
            &model_id,
            &url,
            &filename,
            &dest_dir,
            size_bytes,
            &sha1_expected,
            cancel,
        );

        match result {
            Ok(path) => {
                cancels.lock().unwrap().remove(&model_id);
                if let Ok(mut settings) =
                    crate::settings::SettingsManager::new(app.clone()).get_settings()
                {
                    settings.local_model_path = Some(path.to_string_lossy().to_string());
                    let _ = crate::settings::SettingsManager::new(app.clone())
                        .save_settings(&settings);
                }
                if let Err(e) = app.emit(
                    "model-download-done",
                    serde_json::json!({
                        "id": model_id,
                        "path": path.to_string_lossy()
                    }),
                ) {
                    tracing::warn!("Failed to emit model-download-done: {}", e);
                }
            }
            Err(crate::errors::AppError::Cancelled) => {
                cancels.lock().unwrap().remove(&model_id);
                if let Err(emit_err) =
                    app.emit("model-download-cancelled", serde_json::json!({ "id": model_id }))
                {
                    tracing::warn!("Failed to emit model-download-cancelled: {}", emit_err);
                }
            }
            Err(e) => {
                cancels.lock().unwrap().remove(&model_id);
                tracing::error!("Model download failed: {}", e);
                if let Err(emit_err) = app.emit(
                    "model-download-error",
                    serde_json::json!({ "id": model_id, "message": e.to_string() }),
                ) {
                    tracing::warn!("Failed to emit model-download-error: {}", emit_err);
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn cancel_download(state: State<DownloadState>, id: String) -> Result<()> {
    let cancels = state.cancels.lock().map_err(|_| AppError::Model("Lock poisoned".into()))?;
    if let Some(flag) = cancels.get(&id) {
        flag.store(true, Ordering::SeqCst);
    }
    Ok(())
}

#[tauri::command]
pub fn validate_model(id: String, path: String) -> ModelValidationResult {
    let model = match find_model(&id) {
        Some(m) => m,
        None => {
            return ModelValidationResult {
                valid: false,
                error: Some(format!("Unknown model id: {}", id)),
            }
        }
    };

    match validate_file(std::path::Path::new(&path), model.sha1) {
        Ok(()) => ModelValidationResult {
            valid: true,
            error: None,
        },
        Err(e) => ModelValidationResult {
            valid: false,
            error: Some(e.to_string()),
        },
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

#[allow(clippy::too_many_arguments)]
fn run_download(
    app: &AppHandle,
    model_id: &str,
    url: &str,
    filename: &str,
    dest_dir: &Path,
    total_bytes: u64,
    sha1_expected: &str,
    cancel: Arc<AtomicBool>,
) -> Result<PathBuf> {
    let part_path = dest_dir.join(format!("{}.part", filename));
    let final_path = dest_dir.join(filename);

    std::fs::create_dir_all(dest_dir)
        .map_err(|e| AppError::Model(format!("Cannot create directory: {}", e)))?;

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(3600))
        .build()
        .map_err(|e| AppError::Model(e.to_string()))?;

    let mut response = client
        .get(url)
        .send()
        .map_err(|e| AppError::Model(format!("Download failed: {}", e)))?;

    if !response.status().is_success() {
        return Err(AppError::Model(format!(
            "HTTP {}: {}",
            response.status(),
            url
        )));
    }

    let mut file = std::fs::File::create(&part_path)
        .map_err(|e| AppError::Model(format!("Cannot create file: {}", e)))?;

    let mut downloaded: u64 = 0;
    let mut buf = vec![0u8; 65_536];
    let mut last_emit = std::time::Instant::now();

    loop {
        if cancel.load(Ordering::SeqCst) {
            drop(file);
            let _ = std::fs::remove_file(&part_path);
            return Err(AppError::Cancelled);
        }

        let n = response
            .read(&mut buf)
            .map_err(|e| AppError::Model(format!("Read error: {}", e)))?;

        if n == 0 {
            break;
        }

        file.write_all(&buf[..n])
            .map_err(|e| AppError::Model(format!("Write error: {}", e)))?;

        downloaded += n as u64;

        if last_emit.elapsed() >= std::time::Duration::from_millis(250) {
            if let Err(e) = app.emit(
                "model-download-progress",
                serde_json::json!({
                    "id": model_id,
                    "downloaded": downloaded,
                    "total": total_bytes,
                }),
            ) {
                tracing::warn!("Failed to emit model-download-progress: {}", e);
            }
            last_emit = std::time::Instant::now();
        }
    }

    drop(file);

    // Always emit a final progress event so the frontend sees 100%
    if let Err(e) = app.emit(
        "model-download-progress",
        serde_json::json!({
            "id": model_id,
            "downloaded": downloaded,
            "total": total_bytes,
            "validating": true,
        }),
    ) {
        tracing::warn!("Failed to emit validating progress: {}", e);
    }

    validate_file(&part_path, sha1_expected).inspect_err(|_e| {
        let _ = std::fs::remove_file(&part_path);
    })?;

    std::fs::rename(&part_path, &final_path)
        .map_err(|e| AppError::Model(format!("Rename failed: {}", e)))?;

    Ok(final_path)
}

fn validate_file(path: &std::path::Path, sha1_expected: &str) -> Result<()> {
    let mut file = std::fs::File::open(path)
        .map_err(|e| AppError::Model(format!("Cannot open file for validation: {}", e)))?;

    let metadata = file
        .metadata()
        .map_err(|e| AppError::Model(e.to_string()))?;

    if metadata.len() == 0 {
        return Err(AppError::Model("Model file is empty".to_string()));
    }

    let mut hasher = Sha1::new();
    let mut buf = vec![0u8; 65_536];
    loop {
        let n = file
            .read(&mut buf)
            .map_err(|e| AppError::Model(format!("Read error during validation: {}", e)))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }

    let result = format!("{:x}", hasher.finalize());
    if result != sha1_expected {
        return Err(AppError::Model(format!(
            "Checksum mismatch: expected {}, got {}",
            sha1_expected, result
        )));
    }

    Ok(())
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_has_five_models() {
        assert_eq!(MODELS.len(), 5);
    }

    #[test]
    fn find_model_returns_correct_entry() {
        let m = find_model("small").unwrap();
        assert_eq!(m.filename, "ggml-small.bin");
    }

    #[test]
    fn find_model_returns_none_for_unknown() {
        assert!(find_model("nonexistent").is_none());
    }

    #[test]
    fn validate_file_errors_on_missing_file() {
        let result = validate_file(std::path::Path::new("/nonexistent/path/model.bin"), "abc123");
        assert!(result.is_err());
    }
}
