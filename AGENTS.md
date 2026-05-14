# AGENTS.md

## Project Overview
Ello is a Windows-first Tauri 2 dictation app. It records audio from a global hotkey, transcribes locally with Whisper or remotely with Groq, and types the transcript into the active window.

## Source of Truth
- Read `.sisyphus/plans/ello-dictation.md` before any non-trivial change.
- Read `.sisyphus/notepads/ello-dictation/learnings.md` before touching implementation or docs.
- Treat those files as the current project memory.

## Stack
- Frontend: React 19, TypeScript, Vite, Tailwind.
- Backend: Rust, Tauri 2.
- Core crates: `cpal`, `rubato`, `hound`, `whisper-rs`, `reqwest`, `enigo`, `arboard`, `tauri-plugin-store`, `tauri-plugin-global-shortcut`, `tauri-plugin-autostart`, `tracing`.

## Repository Layout
- `src/` is the React frontend.
- `src-tauri/src/` is the Rust backend.
- `src-tauri/capabilities/` contains Tauri 2 capability definitions.
- `.sisyphus/plans/` contains implementation plans.
- `.sisyphus/notepads/` contains durable learnings.

## Working Rules
- Use `apply_patch` for file edits.
- Use `todowrite` for any task with 3 or more steps.
- Use Context7 for library, framework, SDK, API, or CLI docs before relying on memory.
- Keep changes minimal and local to the requested scope.
- Do not modify `.sisyphus/run-continuation/` files.
- Do not revert, delete, or overwrite user changes unless explicitly asked.
- Do not create commits unless the user explicitly asks for a commit.
- Do not use destructive git commands such as `git reset --hard` or `git checkout --`.

## Build and Test
- Development: `npm run tauri dev`.
- Frontend build: `npm run build`.
- Rust tests: `cargo test`.
- Rust formatting and linting: `cargo fmt --check` and `cargo clippy -- -D warnings`.
- Skip cloud transcription tests unless `GROQ_API_KEY` is set.

## Coding Conventions
- Prefer Rust and TypeScript defaults from the formatter and linter.
- Keep Rust commands thin; put real work in modules and services.
- Keep frontend Tauri calls behind small wrappers instead of scattering `invoke()` everywhere.
- Use `thiserror`-style typed errors for Rust backend failures.
- Never log API keys, raw audio, or transcript contents.

## Architecture Rules
- Keep audio capture, transcription, and output as separate layers.
- Support both local files and microphone input for the audio source.
- Keep local Whisper and Groq behind one `Transcriber` interface.
- Keep output typing and clipboard fallback behind one `OutputSink` interface.
- Use Tauri v2 path APIs such as `app.path().app_data_dir()` and `app.path().app_log_dir()`; do not use v1 `tauri::api::path::*` helpers.
- Update `src-tauri/capabilities/default.json` whenever a new command or plugin is added.

## Testing Discipline
- Use TDD for the Rust core when practical.
- Add integration tests for the transcriber pipeline using a WAV fixture.
- Prefer tests that prove the trait boundaries, not just implementation details.
- Add UI tests only when frontend logic becomes non-trivial.

## Security and Privacy
- Store the Groq API key only in the app store plugin or another secure local store.
- Show a clear cloud-upload warning before first Cloud-mode use.
- Validate downloaded model files before loading them.
- Clear temporary audio and clipboard state when a flow completes.

## Workflow Expectations
- Before making changes, understand the current plan and learnings.
- After discovering durable project facts, append them to the learnings file.
- Keep one logical change per branch when possible.
- If something is unclear, ask one focused question instead of guessing.
- Verify before claiming success.
