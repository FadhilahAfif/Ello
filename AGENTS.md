# AGENTS.md

Repo-level instructions for AI coding agents. See [agents.md](https://agents.md/)
for the convention.

## Stack
- Frontend: React 19, TypeScript, Vite, Tailwind v4.
- Backend: Rust, Tauri 2.
- Storage: SQLite (`rusqlite` bundled), `tauri-plugin-store`.

## Layout
- `src/` React frontend.
- `src-tauri/src/` Rust backend.
- `src-tauri/capabilities/` Tauri 2 capability definitions.

## Build & Test
- `npm run tauri dev` — development.
- `npm run build` — frontend build.
- `cargo test` — Rust tests (Cloud + Whisper tests gated on `GROQ_API_KEY` /
  `WHISPER_MODEL_PATH`).
- `cargo fmt --check` and `cargo clippy -- -D warnings` must pass.

## Working Rules
- Use Context7 (or equivalent) for library docs before relying on memory.
- Keep changes minimal and local to the requested scope.
- Use a task list (your agent's todo / checklist tool) for any task with 3+ steps.
- Do not create commits unless explicitly asked.
- No destructive git commands (`reset --hard`, `checkout --`) without
  permission.
- Never log API keys, raw audio, or transcript contents.

## Conventions
- Rust: defaults from `cargo fmt` / `clippy`. Typed errors via `thiserror`.
  Keep Tauri command handlers thin; real work goes in modules behind traits.
- TypeScript: strict mode, no comments unless explaining a non-obvious
  invariant. Frontend Tauri calls go through `src/lib/invoke.ts` wrappers,
  not scattered `invoke()`.
- Update `src-tauri/capabilities/default.json` whenever a new command or
  plugin is added.

## Architecture
- Audio capture, transcription, and output are separate layers.
- Local Whisper and Groq cloud share one `Transcriber` trait.
- Output typing and clipboard fallback share one `OutputSink` trait.
- Use Tauri v2 path APIs (`app.path().app_data_dir()`,
  `app.path().app_log_dir()`) — not v1 helpers.

## Security
- Groq API key lives in `tauri-plugin-store` only.
- Show a cloud-upload warning before first Cloud-mode use.
- Validate downloaded model files (SHA1) before loading.

## Workflow
- See [CONTRIBUTING.md](CONTRIBUTING.md) for toolchain, commit conventions,
  and updater-key handling.
- See [SECURITY.md](SECURITY.md) and [PRIVACY.md](PRIVACY.md) for the
  user-facing security and privacy contracts.
- Maintainers may keep extra workflow context in a local `AGENTS.local.md`
  (gitignored).