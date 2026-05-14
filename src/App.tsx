import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

// ── Types (mirror src-tauri/src/settings.rs) ────────────────────────────────

type TranscriptionMode = "cloud" | "local";
type HotkeyMode = "toggle" | "pushToTalk";
type RecordingStatus = "idle" | "recording" | "transcribing";

interface AppSettings {
  schemaVersion: number;
  groqApiKey: string | null;
  cloudModel: string;
  transcriptionMode: TranscriptionMode;
  hotkeyMode: HotkeyMode;
  autostartEnabled: boolean;
  micDeviceId: string | null;
}

interface AudioDevice {
  id: string;
  name: string;
  isDefault: boolean;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: 1,
  groqApiKey: null,
  cloudModel: "whisper-large-v3-turbo",
  transcriptionMode: "cloud",
  hotkeyMode: "toggle",
  autostartEnabled: false,
  micDeviceId: null,
};

const CLOUD_MODELS = [
  "whisper-large-v3-turbo",
  "whisper-large-v3",
  "distil-whisper-large-v3-en",
];

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);

  // Load settings and devices on mount
  useEffect(() => {
    Promise.all([
      invoke<AppSettings>("get_settings"),
      invoke<AudioDevice[]>("get_devices"),
    ])
      .then(([s, d]) => {
        setSettings(s);
        setDevices(d);
      })
      .catch((e) => setError(String(e)));
  }, []);

  // Subscribe to backend events
  useEffect(() => {
    let mounted = true;
    const unlisteners: Array<() => void> = [];

    Promise.all([
      listen("recording-started", () => {
        setStatus("recording");
        setLastTranscript(null);
        setError(null);
      }),
      listen("recording-stopped", () => {
        setStatus("transcribing");
      }),
      listen("transcription-started", () => {
        setStatus("transcribing");
      }),
      listen<{ text: string }>("transcription-done", (event) => {
        setStatus("idle");
        setLastTranscript(event.payload.text);
      }),
      listen<{ message: string }>("app-error", (event) => {
        setStatus("idle");
        setError(event.payload.message);
      }),
    ])
      .then((us) => {
        if (!mounted) {
          us.forEach((u) => u());
        } else {
          unlisteners.push(...us);
        }
      })
      .catch((e) => setError(String(e)));

    return () => {
      mounted = false;
      unlisteners.forEach((u) => u());
    };
  }, []);

  const patch = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setError(null);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await invoke("save_settings", { settings });
      setDirty(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <h1 className="app-title">Ello</h1>
        <div className="status-badge">
          <span className={`status-dot${status !== "idle" ? ` ${status}` : ""}`} />
          <span>{status === "recording" ? "Recording…" : status === "transcribing" ? "Transcribing…" : "Idle"}</span>
        </div>
        <p className="last-transcript" aria-live="polite" aria-atomic="true">
          {lastTranscript ?? ""}
        </p>
      </header>

      {/* Error banner */}
      {error && (
        <div className="error-banner" role="alert">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Transcription mode */}
      <section className="card" aria-labelledby="mode-title">
        <span className="card-title" id="mode-title">Transcription Mode</span>
        <div className="segmented" role="group" aria-label="Transcription mode">
          <button
            className={settings.transcriptionMode === "cloud" ? "active" : ""}
            onClick={() => patch("transcriptionMode", "cloud")}
            aria-pressed={settings.transcriptionMode === "cloud"}
          >
            Cloud
          </button>
          <button
            className={settings.transcriptionMode === "local" ? "active" : ""}
            onClick={() => patch("transcriptionMode", "local")}
            aria-pressed={settings.transcriptionMode === "local"}
          >
            Local
          </button>
        </div>

        {settings.transcriptionMode === "cloud" && (
          <>
            <div className="cloud-warning" role="note">
              Cloud mode sends audio to Groq's servers for transcription.
            </div>
            <div className="field">
              <label htmlFor="cloud-model">Model</label>
              <select
                id="cloud-model"
                value={settings.cloudModel}
                onChange={(e) => patch("cloudModel", e.target.value)}
              >
                {CLOUD_MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="groq-key">Groq API Key</label>
              <input
                id="groq-key"
                type="password"
                autoComplete="off"
                placeholder="gsk_…"
                value={settings.groqApiKey ?? ""}
                onChange={(e) =>
                  patch("groqApiKey", e.target.value || null)
                }
              />
            </div>
          </>
        )}
      </section>

      {/* Audio device */}
      <section className="card" aria-labelledby="audio-title">
        <span className="card-title" id="audio-title">Audio Input</span>
        <div className="field">
          <label htmlFor="mic-device">Microphone</label>
          <select
            id="mic-device"
            value={settings.micDeviceId ?? "default"}
            onChange={(e) =>
              patch("micDeviceId", e.target.value === "default" ? null : e.target.value)
            }
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}{d.isDefault ? " (default)" : ""}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Hotkey */}
      <section className="card" aria-labelledby="hotkey-title">
        <span className="card-title" id="hotkey-title">Hotkey</span>
        <div className="segmented" role="group" aria-label="Hotkey mode">
          <button
            className={settings.hotkeyMode === "toggle" ? "active" : ""}
            onClick={() => patch("hotkeyMode", "toggle")}
            aria-pressed={settings.hotkeyMode === "toggle"}
          >
            Toggle
          </button>
          <button
            className={settings.hotkeyMode === "pushToTalk" ? "active" : ""}
            onClick={() => patch("hotkeyMode", "pushToTalk")}
            aria-pressed={settings.hotkeyMode === "pushToTalk"}
          >
            Push to Talk
          </button>
        </div>
        <div className="hotkey-display">
          {/* TODO: read from settings when hotkey becomes configurable */}
          <span className="hotkey-badge">Alt+Shift+D</span>
        </div>
      </section>

      {/* App behaviour */}
      <section className="card" aria-labelledby="behaviour-title">
        <span className="card-title" id="behaviour-title">App Behaviour</span>
        <div className="toggle-row">
          <span>Start with Windows</span>
          <label className="toggle" aria-label="Start with Windows">
            <input
              type="checkbox"
              checked={settings.autostartEnabled}
              onChange={(e) => patch("autostartEnabled", e.target.checked)}
            />
            <span className="toggle-track" />
          </label>
        </div>
      </section>

      {/* Save */}
      <button
        className="btn-save"
        onClick={handleSave}
        disabled={!dirty || saving}
        aria-busy={saving}
      >
        {saving ? "Saving…" : dirty ? "Save Settings" : "Saved"}
      </button>
    </div>
  );
}
