use arboard::Clipboard;
use enigo::{
    Direction::{Click, Press, Release},
    Enigo, Key, Keyboard, Settings,
};

use crate::errors::{AppError, Result};

pub trait OutputSink: Send {
    fn output(&self, text: &str) -> Result<()>;
}

/// Types text directly into the active window using enigo.
pub struct EnigoTyper;

/// Copies text to the clipboard then pastes via Ctrl+V.
pub struct ClipboardSink;

/// Tries `EnigoTyper` first; falls back to `ClipboardSink` on error.
pub struct FallbackSink;

impl OutputSink for EnigoTyper {
    fn output(&self, text: &str) -> Result<()> {
        let mut enigo = Enigo::new(&Settings::default())
            .map_err(|e| AppError::Output(e.to_string()))?;
        enigo
            .text(text)
            .map_err(|e| AppError::Output(e.to_string()))?;
        Ok(())
    }
}

impl OutputSink for ClipboardSink {
    fn output(&self, text: &str) -> Result<()> {
        let mut clipboard =
            Clipboard::new().map_err(|e| AppError::Output(e.to_string()))?;
        clipboard
            .set_text(text.to_string())
            .map_err(|e| AppError::Output(e.to_string()))?;

        // Small delay to let clipboard settle before pasting.
        std::thread::sleep(std::time::Duration::from_millis(50));

        let mut enigo = Enigo::new(&Settings::default())
            .map_err(|e| AppError::Output(e.to_string()))?;
        enigo
            .key(Key::Control, Press)
            .map_err(|e| AppError::Output(e.to_string()))?;

        let paste_result = enigo
            .key(Key::Unicode('v'), Click)
            .map_err(|e| AppError::Output(e.to_string()));

        // Always release Ctrl, even if paste failed
        let release_result = enigo
            .key(Key::Control, Release)
            .map_err(|e| AppError::Output(e.to_string()));

        paste_result?;
        release_result?;
        Ok(())
    }
}

impl OutputSink for FallbackSink {
    fn output(&self, text: &str) -> Result<()> {
        match EnigoTyper.output(text) {
            Ok(()) => Ok(()),
            Err(e) => {
                tracing::warn!(
                    "EnigoTyper failed ({}), falling back to clipboard",
                    e
                );
                ClipboardSink.output(text)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fallback_sink_is_send() {
        fn assert_send<T: Send>() {}
        assert_send::<FallbackSink>();
    }
}
