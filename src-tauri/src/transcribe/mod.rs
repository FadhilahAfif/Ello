pub mod cloud;

use crate::errors::Result;

/// Anything that can turn a mono 16 kHz f32 PCM buffer into a transcript string.
pub trait Transcriber: Send {
    fn transcribe(&self, pcm: &[f32]) -> Result<String>;
}
