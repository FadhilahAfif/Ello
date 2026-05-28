# Contributing to Ello

Thanks for your interest in contributing! This document covers the toolchain
setup, development workflow, testing rules, commit conventions, and updater
key handling.

By participating, you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Toolchain Requirements

- **Rust** stable (latest)
- **Node** 20+
- **MSVC Build Tools** — Visual Studio 2022, or "Build Tools for Visual Studio
  2022" with the "Desktop development with C++" workload.
- **CMake** 3.20+ (required by `whisper-rs-sys` build script)
- **LLVM / libclang** (required by `whisper-rs` bindgen) — set
  `LIBCLANG_PATH=C:\Program Files\LLVM\bin`

Optional:

- **WiX Toolset 3.x** if you plan to build MSI installers locally.

## Getting Started

```sh
git clone https://github.com/FadhilahAfif/Ello.git
cd Ello
npm install
npm run tauri dev
```

The first run compiles all Rust dependencies from scratch and can take 5–15
minutes; subsequent runs use the cargo cache and finish in seconds.

## Development Workflow

1. Read [`.sisyphus/plans/ello-dictation.md`](.sisyphus/plans/ello-dictation.md)
   to understand the current roadmap and the phase any change belongs to.
2. Read [`.sisyphus/notepads/ello-dictation/learnings.md`](.sisyphus/notepads/ello-dictation/learnings.md)
   before touching backend or UI code; it captures non-obvious gotchas
   discovered during earlier phases.
3. Branch from `main` with a descriptive name (`feature/...`, `fix/...`,
   `docs/...`, `chore/...`).
4. Keep one logical change per branch when practical.
5. Update plans and learnings as you go: tick checklist items in the plan,
   append durable facts to the learnings file.

## Running Tests

```sh
cargo fmt --check
cargo clippy -- -D warnings
cargo test
npm run build
```

All four must pass before opening a PR. Cloud and local-Whisper integration
tests are gated on environment variables and skip silently when those are
unset:

- `GROQ_API_KEY` — enables cloud transcription tests.
- `WHISPER_MODEL_PATH` — enables local Whisper tests; point this at a `.bin`
  GGML model file.

For manual smoke testing, run `npm run tauri dev` and exercise the relevant
flow. Cover at minimum: toggle hotkey, push-to-talk, active-window typing,
clipboard fallback, transcript history search, vocabulary substitution, and
(if Cloud-mode work) the privacy banner on first use.

## Code Style

- **Rust:** `cargo fmt` formatting; `cargo clippy -- -D warnings` must be
  clean. Prefer typed errors via `thiserror`. Keep Tauri command handlers
  thin and put real work in modules behind traits.
- **TypeScript:** TypeScript strict mode (already enabled). `npm run build`
  must pass with zero errors and zero new warnings.
- **No comments** in code unless they explain something the code itself
  cannot — non-obvious invariants, link-outs to external docs, or workaround
  rationale.
- **Frontend:** read [`DESIGN.md`](DESIGN.md) before changing any UI. Use
  named spacing tokens (`px-[var(--space-N)]`), `lucide-react` icons, and
  `focus-visible:` rings.
- **Privacy:** never log API keys, raw audio, or transcript contents. Errors
  surfaced to the frontend must never include Groq response bodies verbatim.
- **Capabilities:** update `src-tauri/capabilities/default.json` whenever you
  add a new command, event, or plugin.

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

Format:

```
<type>(<optional scope>): <subject>

<optional body>

<optional footer>
```

Common types:

- `feat:` new user-facing feature
- `fix:` bug fix
- `docs:` documentation only
- `refactor:` code change that neither fixes a bug nor adds a feature
- `perf:` performance improvement
- `test:` adding or updating tests
- `chore:` tooling, dependencies, build config
- `ci:` CI workflow changes

Subject line: imperative mood, no trailing period, ≤72 characters. Body
explains the *why*, not the *what*. Footer references issues
(`Closes #123`) and breaking changes (`BREAKING CHANGE: ...`).

Examples:

```
feat(history): add bulk export to markdown
fix(hotkey): release stuck modifier keys when push-to-talk window closes
docs(privacy): clarify what is sent to Groq in Cloud mode
```

## Pull Requests

1. Push your branch and open a PR against `main`.
2. Fill in the [PR template](.github/PULL_REQUEST_TEMPLATE.md) — summary,
   testing notes, and screenshots for UI changes.
3. CI must pass (`cargo fmt --check`, `cargo clippy -- -D warnings`,
   `cargo test`, `npm run build`).
4. PR titles should follow Conventional Commits as well; the title becomes the
   merge commit subject.
5. Keep PRs focused. Refactors should land separately from features.
6. Be responsive to review comments; squash fixup commits before merge.

## Updater Signing Keys

Ello uses `tauri-plugin-updater` with minisign keypairs to verify update
packages.

### Public key

The public key is checked into the repo at `src-tauri/updater-pub.key` and
referenced in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`. Do
not modify it unless you are rotating keys.

### Private key

The private key (`src-tauri/updater-priv.key`) is **never committed**. It is
listed in `.gitignore`. It must be stored in two places:

1. **Password manager** — store the full base64 contents of
   `updater-priv.key` as a secure note. Label it `Ello updater private key`.
   Add the password (if any) as a separate note labelled
   `Ello updater private key password`.
2. **GitHub Actions secret** — add the contents as a repository secret named
   `TAURI_SIGNING_PRIVATE_KEY`. The release workflow reads this secret to
   sign update bundles. If the key has a password, also store it as
   `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

### Generating a new keypair (key rotation)

Only do this if the private key is lost or compromised.

```sh
npx @tauri-apps/cli signer generate -w src-tauri/updater-pub.key -p "" --ci
```

This writes the private key to `src-tauri/updater-pub.key` and the public
key to `src-tauri/updater-pub.key.pub`. Rename them:

```sh
mv src-tauri/updater-pub.key src-tauri/updater-priv.key
mv src-tauri/updater-pub.key.pub src-tauri/updater-pub.key
```

Then update `plugins.updater.pubkey` in `src-tauri/tauri.conf.json` with the
new public key contents, commit the public key, and update the GitHub
Actions secret with the new private key.

> **Warning:** rotating keys breaks auto-update for all users on the old key.
> They must download and install the new version manually.

### Recovery process

If the private key is lost:

1. Generate a new keypair as above.
2. Publish a release signed with the new key.
3. Users on old versions will not receive the auto-update and must reinstall
   manually.
4. Document the rotation in `CHANGELOG.md`.

## Vendored UI Components

Components in `src/components/ui/` are vendored from shadcn patterns (not
installed via the shadcn CLI). To sync with upstream, copy the relevant
component source from the shadcn-ui repo and adapt it to the project's
design tokens defined in `src/index.css`. Do not run the shadcn CLI directly
against this repo; it assumes a Next.js / Vite-default layout that does not
match.

## Tailwind Version

Tailwind v4 is pinned in `package.json`. The config lives entirely in
`src/index.css` via `@import "tailwindcss"` — there is no
`tailwind.config.js`. When upgrading, check the v4 migration guide for any
breaking changes to utility names or CSS variable conventions, and run
`npm run build` to surface any breakage.

## Reporting Security Issues

Do not file public issues for security vulnerabilities. See
[SECURITY.md](SECURITY.md) for the private disclosure process.
