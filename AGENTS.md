# AGENTS.md

Repo-level instructions for AI coding agents. See [agents.md](https://agents.md/)
for the convention.

## Stack

- Frontend: React 19, TypeScript, Vite, Tailwind v4.
- Backend: Rust, Tauri 2.
- Storage: SQLite (`rusqlite` bundled), `tauri-plugin-store`.

## Layout

- `src/` React frontend.
- `src/lib/invoke.ts` typed frontend wrappers around Tauri commands.
- `src-tauri/src/` Rust backend.
- `src-tauri/capabilities/` Tauri 2 capability definitions.

## Build & Test

- `npm run tauri dev` - development.
- `npm run build` - frontend build.
- `cd src-tauri; cargo fmt --check` - Rust formatting check.
- `cd src-tauri; cargo clippy -- -D warnings` - Rust lint check.
- `cd src-tauri; cargo test` - Rust tests. Cloud and Whisper integration tests
  are ignored unless their documented environment variables are supplied.

## Working Rules

- Keep changes minimal and local to the requested scope.
- Use current library docs before changing framework, SDK, API, CLI, or cloud
  service usage.
- Do not create commits unless explicitly asked.
- No destructive git commands without permission.
- Leave unrelated user changes alone.
- Do not add dependencies when the standard library, platform APIs, or
  installed packages are enough.

## Architecture

- Keep audio capture, transcription, and output as separate layers.
- Local Whisper and Groq Cloud share one `Transcriber` trait.
- Output typing and clipboard fallback share one `OutputSink` trait.
- Keep Tauri command handlers thin; real work goes in modules behind traits.
- Frontend Tauri calls go through `src/lib/invoke.ts`, not scattered raw
  `invoke()` calls.
- Use Tauri v2 path APIs such as `app.path().app_data_dir()` and
  `app.path().app_log_dir()`.
- Update `src-tauri/capabilities/default.json` whenever a command, event, or
  plugin permission is added.

## Security

- Never log API keys, raw audio, or transcript contents.
- Groq API keys live in Windows Credential Manager only.
- Require explicit cloud-upload acknowledgment before Cloud-mode use.
- Validate downloaded model files before loading.
- Errors shown to the frontend must not include Groq response bodies verbatim.

## Workflow

- See [CONTRIBUTING.md](CONTRIBUTING.md) for toolchain, commit conventions,
  and updater-key handling.
- See [SECURITY.md](SECURITY.md) and [PRIVACY.md](PRIVACY.md) for the
  user-facing security and privacy contracts.
- Maintainers may keep private local workflow notes in `AGENTS.local.md`, which
  is gitignored.
