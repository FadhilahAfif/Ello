# Changelog

All notable changes to Ello are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Targeted as `v1.0.0` — the first public release. Until that tag ships, every
change lands here.

### Added

- Tauri 2 scaffold renamed to Ello (`com.ello.dictation`).
- Audio capture via `cpal` with downmix to mono and 16 kHz resample via
  `rubato`; bounded recording length.
- WAV-source path for tests so the pipeline can run without a microphone.
- Cloud transcription via Groq (`whisper-large-v3-turbo` default) with
  multipart upload, timeout, retry, and a privacy banner.
- Local Whisper transcription via `whisper-rs` against GGML model files in
  app data.
- Single `Transcriber` trait shared by Cloud and Local backends.
- Global toggle and push-to-talk shortcuts via
  `tauri-plugin-global-shortcut` with conflict handling.
- Active-window typing via `enigo` with `arboard` clipboard fallback when
  typing fails.
- System tray with hide-on-close and opt-in autostart via
  `tauri-plugin-autostart`.
- Local model manager: hardcoded manifest of multilingual GGML models with
  streaming download, SHA1 validation, atomic rename, and cancel support.
- Sidebar shell with hash router; one component per page.
- Dark theme with design tokens (background layers, text, accent, semantic
  states) defined as CSS variables in `src/index.css`.
- Vendored shadcn-style UI primitives in `src/components/ui/`.
- SQLite data layer (`rusqlite` with `bundled` feature) at
  `app_data_dir()/ello.db` with versioned migrations.
- Transcript history with FTS5 full-text search, copy, delete, and bulk
  export to txt / json / markdown.
- Custom vocabulary rules (exact, prefix, contains; case-sensitive flag)
  applied to every transcript before output.
- Optional AI Polish step that pipes transcripts through a Groq chat model
  with configurable prompt, model, and minimum-word threshold; soft-fails to
  the raw transcript on any error.
- Live mic meter computed in the CPAL input callback and emitted at 30 Hz.
- Dashboard with status hero, today's stats, and recent transcripts.
- Stats page with 7 / 30 / 90-day totals and SVG bar chart.
- First-run onboarding wizard (mode → API key or model download → hotkey
  → mic test).
- Auto-update via `tauri-plugin-updater` against signed GitHub releases.
- Settings and vocabulary import / export to `.elloconfig` JSON, with an
  opt-in for including the API key.
- Toast notifications, opt-in autostart.
- Typed errors via `thiserror`; logging to daily-rotated files via
  `tracing-appender`.
- Open-source readiness: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `SECURITY.md`, `PRIVACY.md`, issue and PR templates, CI and release
  workflows, Dependabot config.

### Changed

- Settings schema bumped from v1 to v2 with backward-compatible migration.
- README rewritten to focus on users (install, features, privacy).

### Security

- Groq API key is excluded from settings exports by default.
- Groq response bodies are no longer included in error messages surfaced to
  the frontend; only the HTTP status code is shown.

[Unreleased]: https://github.com/FadhilahAfif/Ello/compare/main...HEAD
