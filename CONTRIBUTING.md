# Contributing to Ello

## Toolchain Requirements

- Rust stable (latest)
- Node 20+
- MSVC Build Tools (Visual Studio 2022 or Build Tools for Visual Studio 2022)
- CMake 3.20+
- LLVM/libclang (required by `whisper-rs` bindgen) — set `LIBCLANG_PATH=C:\Program Files\LLVM\bin`

## Running Tests

```
cargo test
npm run build
```

Cloud and Whisper integration tests are gated on environment variables:

- `GROQ_API_KEY` — enables cloud transcription tests
- `WHISPER_MODEL_PATH` — enables local Whisper tests

## Code Style

- Rust: `cargo fmt` and `cargo clippy -- -D warnings` must pass before every commit.
- TypeScript: `npm run build` (tsc + vite) must pass.
- No comments in code unless explicitly requested.
- Conventional Commits format for commit messages.

## Updater Signing Keys

Ello uses `tauri-plugin-updater` with minisign keypairs to verify update packages.

### Public key

The public key is checked into the repo at `src-tauri/updater-pub.key` and
referenced in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`.
Do not modify it unless you are rotating keys.

### Private key

The private key (`src-tauri/updater-priv.key`) is **never committed**. It is
listed in `.gitignore`. You must store it in two places:

1. **Password manager** — store the full base64 contents of `updater-priv.key`
   as a secure note. Label it `Ello updater private key`.
2. **GitHub Actions secret** — add the contents as a repository secret named
   `TAURI_SIGNING_PRIVATE_KEY`. The release workflow reads this secret to sign
   update bundles.

If the key has a password, also store it as `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

### Generating a new keypair (key rotation)

Only do this if the private key is lost or compromised.

```
npx @tauri-apps/cli signer generate -w src-tauri/updater-pub.key -p "" --ci
```

This writes the private key to `src-tauri/updater-pub.key` and the public key
to `src-tauri/updater-pub.key.pub`. Rename them:

```
mv src-tauri/updater-pub.key src-tauri/updater-priv.key
mv src-tauri/updater-pub.key.pub src-tauri/updater-pub.key
```

Then update `plugins.updater.pubkey` in `src-tauri/tauri.conf.json` with the
new public key contents, commit the public key, and update the GitHub Actions
secret with the new private key.

**Warning:** rotating keys breaks auto-update for all users on the old key.
They will need to download and install the new version manually.

### Recovery process

If the private key is lost:

1. Generate a new keypair as above.
2. Publish a release signed with the new key.
3. Users on old versions will not receive the auto-update and must reinstall manually.
4. Document the rotation in `CHANGELOG.md`.

## Vendored UI Components

Components in `src/components/ui/` are vendored from shadcn patterns (not
installed via the shadcn CLI). To sync with upstream, copy the relevant
component source and adapt it to the project's design tokens.

## Tailwind Version

Tailwind v4 is pinned in `package.json`. The config lives entirely in
`src/index.css` via `@import "tailwindcss"` — there is no `tailwind.config.js`.
When upgrading, check the v4 migration guide for any breaking changes to
utility names or CSS variable conventions.
