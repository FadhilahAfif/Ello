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

#[cfg(any(target_os = "windows", test))]
fn wait_for_modifiers_to_release(
    mut modifiers_pressed: impl FnMut() -> bool,
    mut wait: impl FnMut(),
    max_waits: usize,
) -> bool {
    for _ in 0..max_waits {
        if !modifiers_pressed() {
            return true;
        }
        wait();
    }

    !modifiers_pressed()
}

#[cfg(target_os = "windows")]
fn wait_for_output_modifiers() -> Result<()> {
    const VK_SHIFT: i32 = 0x10;
    const VK_CONTROL: i32 = 0x11;
    const VK_MENU: i32 = 0x12;
    const VK_LWIN: i32 = 0x5B;
    const VK_RWIN: i32 = 0x5C;
    const MODIFIER_KEYS: [i32; 5] = [VK_SHIFT, VK_CONTROL, VK_MENU, VK_LWIN, VK_RWIN];
    const POLL_INTERVAL: std::time::Duration = std::time::Duration::from_millis(10);
    const MAX_WAITS: usize = 200;

    #[link(name = "user32")]
    unsafe extern "system" {
        #[link_name = "GetAsyncKeyState"]
        fn get_async_key_state(v_key: i32) -> i16;
    }

    let released = wait_for_modifiers_to_release(
        || {
            MODIFIER_KEYS.iter().any(|&key| {
                // SAFETY: GetAsyncKeyState accepts any virtual-key code and has no pointer arguments.
                unsafe { get_async_key_state(key) < 0 }
            })
        },
        || std::thread::sleep(POLL_INTERVAL),
        MAX_WAITS,
    );

    if released {
        Ok(())
    } else {
        // ponytail: A short ceiling prevents a stuck modifier from blocking output forever.
        Err(AppError::Output(
            "Timed out waiting for keyboard modifiers to be released".to_string(),
        ))
    }
}

#[cfg(not(target_os = "windows"))]
fn wait_for_output_modifiers() -> Result<()> {
    Ok(())
}

impl OutputSink for EnigoTyper {
    fn output(&self, text: &str) -> Result<()> {
        let mut enigo =
            Enigo::new(&Settings::default()).map_err(|e| AppError::Output(e.to_string()))?;
        enigo
            .text(text)
            .map_err(|e| AppError::Output(e.to_string()))?;
        Ok(())
    }
}

impl OutputSink for ClipboardSink {
    fn output(&self, text: &str) -> Result<()> {
        let mut clipboard = Clipboard::new().map_err(|e| AppError::Output(e.to_string()))?;
        clipboard
            .set_text(text.to_string())
            .map_err(|e| AppError::Output(e.to_string()))?;

        // Small delay to let clipboard settle before pasting.
        std::thread::sleep(std::time::Duration::from_millis(50));

        let mut enigo =
            Enigo::new(&Settings::default()).map_err(|e| AppError::Output(e.to_string()))?;
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
        wait_for_output_modifiers()?;

        match EnigoTyper.output(text) {
            Ok(()) => Ok(()),
            Err(e) => {
                tracing::warn!("EnigoTyper failed ({}), falling back to clipboard", e);
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

    #[test]
    fn waits_until_held_modifiers_are_released() {
        let mut modifier_states = [true, true, false].into_iter();
        let mut waits = 0;

        let released = wait_for_modifiers_to_release(
            || modifier_states.next().unwrap_or(false),
            || waits += 1,
            10,
        );

        assert!(released);
        assert_eq!(waits, 2);
    }

    #[test]
    fn stops_waiting_when_modifiers_never_release() {
        let mut waits = 0;

        let released = wait_for_modifiers_to_release(|| true, || waits += 1, 3);

        assert!(!released);
        assert_eq!(waits, 3);
    }
}
