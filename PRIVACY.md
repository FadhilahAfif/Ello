# Privacy

Ello is designed to keep your dictation data on your machine by default.
This document explains exactly what is stored locally, what is sent over
the network, and how to wipe everything.

## TL;DR

- **Local mode** (Whisper): nothing leaves your computer.
- **Cloud mode** (Groq): audio is uploaded to Groq for transcription. The
  resulting text comes back and is typed into your active window. The audio
  is not retained by Ello after transcription.
- Transcript history and usage stats are stored locally in a SQLite database.
- Ello does **not** include analytics, telemetry, crash reporting, or any
  third-party tracking.

## Data Stored Locally

All Ello data lives under your Windows app data directory:

```
%APPDATA%\com.ello.dictation\
```

| File / folder            | Contents                                                                 |
|--------------------------|--------------------------------------------------------------------------|
| `settings.json`          | Mode, hotkey, audio device, AI Polish prompt, **Groq API key**, toggles. |
| `ello.db`                | SQLite DB: transcripts, vocabulary rules, daily usage stats.             |
| `models/`                | Local Whisper GGML model files (only if you downloaded any).             |
| `logs/`                  | Daily-rotated log files written by `tracing`.                            |
| `mic_test.wav`           | Last 5-second microphone test recording from onboarding.                 |

The Groq API key is stored in plain text inside `settings.json`. Anyone with
read access to your user profile can read it. Treat it like any other local
credential.

Logs deliberately exclude raw audio, transcripts, and API keys.

## Data Sent Over the Network

Ello makes outbound network requests in only these situations:

1. **Cloud mode transcription** — when you finish a recording with mode set
   to "Cloud", Ello uploads the recorded WAV to
   `https://api.groq.com/openai/v1/audio/transcriptions` along with your
   API key. Groq returns the transcript text. See
   [Groq's privacy policy](https://groq.com/privacy-policy/) for what they
   do with submitted audio.
2. **AI Polish (opt-in)** — if you enable AI Polish in Settings, transcripts
   above your minimum-word threshold are also sent to
   `https://api.groq.com/openai/v1/chat/completions` for post-processing.
3. **Model downloads** — when you download a Whisper model from the in-app
   manager, Ello fetches the file from the URL listed in the model
   manifest (typically `huggingface.co`). Only the bytes of the model are
   transferred.
4. **Update checks** — `tauri-plugin-updater` queries the Ello GitHub
   release manifest at
   `https://github.com/FadhilahAfif/Ello/releases/latest/download/latest.json`
   and downloads signed installer bundles when an update is available.
   GitHub records the IP address making the request the same way it would
   for any visit to a public release page.

Ello does **not**:

- Send audio, transcripts, or settings to the maintainers.
- Run analytics, telemetry, or crash reporting.
- Embed third-party SDKs that phone home.
- Sync any data to a cloud service Ello operates.

## Cloud-Upload Warning

The first time you switch to Cloud mode, Ello shows a banner explaining
that audio will be uploaded to Groq. The banner stays visible in the
Settings page while Cloud mode is active. You can switch back to Local
mode at any time to stop further uploads.

## History and Stats Retention

In the current v1 UI, successful dictation sessions are stored in local
history and usage stats. The History page can clear transcript history, and
the full local database can be deleted to reset stats (see "Wiping Data"
below).

## Wiping Data

To remove specific categories:

- **Transcript history:** History page → "Clear all" button. This deletes
  every row from the `transcripts` table and rebuilds the FTS index.
- **Vocabulary rules:** Vocabulary page → delete rows individually.
- **Stats:** there is no in-app "clear stats" button in v1; delete
  `ello.db` to reset (this also clears history and vocabulary).

To wipe **everything** Ello has stored:

1. Quit Ello (right-click the tray icon → Quit).
2. Delete the entire folder:

   ```
   %APPDATA%\com.ello.dictation\
   ```

3. (Optional) Uninstall Ello via Windows Settings → Apps if you want it
   gone for good.

To revoke cloud access:

1. Sign in to your Groq account and revoke the API key you used in Ello.
2. Clear the key in Ello's Settings page (or wipe data as above).

## Imported and Exported Files

The Settings page can export your settings and vocabulary rules to a
`.elloconfig` JSON file. By default the export **excludes** your Groq API
key. There is an opt-in checkbox to include it; if you tick that and share
the file, you are sharing your API key. A warning is shown next to the
checkbox.

Import does the inverse and overwrites your current settings after a
confirmation dialog.

## Children's Privacy

Ello is not directed at children under 13. It collects no personal data
beyond what you voluntarily put into the app (your hotkey, your API key,
your transcripts, your vocabulary rules), all of which stay on your
machine.

## Changes to This Policy

If Ello ever starts collecting additional data — including telemetry or
crash reporting — that change will be:

- Documented in `CHANGELOG.md`.
- Surfaced as a prompt on first launch of the new version.
- Off by default unless explicitly opted in.

## Questions

For privacy questions that aren't security vulnerabilities, open a
[Discussion](https://github.com/FadhilahAfif/Ello/discussions). For
security issues, see [SECURITY.md](SECURITY.md).
