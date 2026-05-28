# Security Policy

Thanks for helping keep Ello and its users safe.

## Reporting a Vulnerability

**Do not file a public GitHub issue for security vulnerabilities.** Public
issues are visible to everyone and could put users at risk before a fix is
released.

Report vulnerabilities privately via [GitHub Security Advisories](https://github.com/FadhilahAfif/Ello/security/advisories/new).
This creates a private channel between you and the maintainers.

When reporting, please include:

- A clear description of the vulnerability and its impact.
- Steps to reproduce, ideally with a minimal proof of concept.
- The Ello version and Windows version where you observed the issue.
- Any suggested mitigations.

## Response Time

- **Acknowledgement:** within 7 days of report.
- **Initial assessment:** within 14 days.
- **Fix or mitigation timeline:** communicated after assessment, typically
  within 30 days for high-severity issues. Low-severity issues may be
  scheduled for a later release.

If you do not receive a reply within 7 days, please follow up on the
advisory thread.

## Scope

The following are in scope:

- The Ello desktop app (Rust backend, React frontend, Tauri runtime).
- The auto-updater pipeline and signing flow.
- Bundled installers published on the [Releases](https://github.com/FadhilahAfif/Ello/releases) page.

The following are **out of scope**:

- Vulnerabilities in upstream dependencies (`tauri`, `whisper-rs`, `cpal`,
  `enigo`, `arboard`, `rusqlite`, etc.) — please report those upstream.
  Ello will pick them up via dependency updates.
- The Groq API itself — report to Groq directly.
- Self-XSS or social-engineering attacks against the user's own machine
  (e.g. an attacker who already has local code execution).
- Issues requiring a malicious local model file the user manually placed in
  their model directory.

## Disclosure

After a fix is released, the advisory may be published with credit to the
reporter (with permission). We follow coordinated disclosure: details are
held private until users have had a reasonable window to update.

## Hardening Tips for Users

- Keep Ello up to date via the in-app updater.
- Only download GGML models from the official manifest or a source you
  trust; the app validates SHA1 checksums but cannot validate model
  intent.
- Treat your Groq API key like a password. Revoke and rotate it immediately
  if you suspect it has leaked.
