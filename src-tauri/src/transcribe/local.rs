use crate::errors::{AppError, Result};
use crate::transcribe::Transcriber;
use std::path::{Path, PathBuf};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

pub struct LocalWhisperTranscriber {
    model_path: PathBuf,
    language: Option<String>,
}

impl LocalWhisperTranscriber {
    /// `model_path` must point to a ggml `.bin` model file.
    /// `language` is an optional BCP-47 language code (e.g. `"en"`).
    /// Pass `None` to let Whisper auto-detect.
    pub fn new(model_path: impl Into<PathBuf>, language: Option<String>) -> Self {
        Self {
            model_path: model_path.into(),
            language,
        }
    }

    /// Validate the model file exists and has a non-zero size before loading.
    fn validate_model(path: &Path) -> Result<()> {
        let meta = std::fs::metadata(path).map_err(|e| {
            AppError::Transcription(format!("Model file not found at {}: {}", path.display(), e))
        })?;
        if meta.len() == 0 {
            return Err(AppError::Transcription(format!(
                "Model file is empty: {}",
                path.display()
            )));
        }
        Ok(())
    }
}

impl Transcriber for LocalWhisperTranscriber {
    fn transcribe(&self, pcm: &[f32]) -> Result<String> {
        Self::validate_model(&self.model_path)?;

        let ctx = WhisperContext::new_with_params(
            self.model_path
                .to_str()
                .ok_or_else(|| AppError::Transcription("Invalid model path".to_string()))?,
            WhisperContextParameters::default(),
        )
        .map_err(|e| AppError::Transcription(format!("Failed to load Whisper model: {e}")))?;

        let mut state = ctx
            .create_state()
            .map_err(|e| AppError::Transcription(format!("Failed to create Whisper state: {e}")))?;

        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_language(self.language.as_deref());
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);

        state
            .full(params, pcm)
            .map_err(|e| AppError::Transcription(format!("Whisper inference failed: {e}")))?;

        let n = state.full_n_segments();

        let mut text = String::new();
        for i in 0..n {
            let seg = state
                .get_segment(i)
                .ok_or_else(|| AppError::Transcription(format!("Failed to get segment {i}")))?;
            let seg_text = seg.to_str().map_err(|e| {
                AppError::Transcription(format!("Invalid UTF-8 in segment {i}: {e}"))
            })?;
            if !text.is_empty() {
                text.push(' ');
            }
            text.push_str(seg_text.trim());
        }

        Ok(text)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio::AudioSource;

    #[test]
    fn validate_model_errors_on_missing_file() {
        let result = LocalWhisperTranscriber::validate_model(Path::new("/nonexistent/model.bin"));
        assert!(result.is_err());
        let msg = result.unwrap_err().to_string();
        assert!(msg.contains("Model file not found"));
    }

    #[test]
    #[ignore = "requires ggml model file"]
    fn local_transcriber_with_fixture() {
        let model = std::env::var("WHISPER_MODEL_PATH").expect("WHISPER_MODEL_PATH not set");
        let fixture = std::env::var("WHISPER_AUDIO_PATH").expect("WHISPER_AUDIO_PATH not set");

        let mut src = crate::audio::WavSource::new(&fixture);
        let pcm = src.record(60).unwrap();

        let transcriber = LocalWhisperTranscriber::new(model, Some("en".to_string()));
        let text = transcriber.transcribe(&pcm).unwrap();
        assert!(!text.is_empty());
    }
}
