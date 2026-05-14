import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

// ── Types (mirror src-tauri/src/settings.rs) ────────────────────────────────

type TranscriptionMode = "cloud" | "local";
type HotkeyMode = "toggle" | "pushToTalk";
type RecordingStatus = "idle" | "recording" | "transcribing";

interface ModelInfo {
  id: string;
  name: string;
  filename: string;
  sizeBytes: number;
  sha1: string;
}

type ModelStatus =
  | { kind: "idle" }
  | { kind: "downloading"; downloaded: number; total: number }
  | { kind: "validating" }
  | { kind: "installed"; path: string }
  | { kind: "error"; message: string };

interface AppSettings {
  schemaVersion: number;
  groqApiKey: string | null;
  cloudModel: string;
  transcriptionMode: TranscriptionMode;
  hotkeyMode: HotkeyMode;
  autostartEnabled: boolean;
  micDeviceId: string | null;
  localModelPath: string | null;
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
  localModelPath: null,
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
  const [manifest, setManifest] = useState<ModelInfo[]>([]);
  const [modelStatuses, setModelStatuses] = useState<Record<string, ModelStatus>>({});

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
    invoke<ModelInfo[]>("get_model_manifest").then(setManifest).catch(console.error);
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
      listen<{ id: string; downloaded: number; total: number; validating?: boolean }>(
        "model-download-progress",
        (event) => {
          const { id, downloaded, total, validating } = event.payload;
          setModelStatuses((prev) => ({
            ...prev,
            [id]: validating
              ? { kind: "validating" }
              : { kind: "downloading", downloaded, total },
          }));
        }
      ),
      listen<{ id: string; path: string }>("model-download-done", (event) => {
        const { id, path } = event.payload;
        setModelStatuses((prev) => ({ ...prev, [id]: { kind: "installed", path } }));
        setSettings((prev) => ({ ...prev, localModelPath: path }));
      }),
      listen<{ id: string; message: string }>("model-download-error", (event) => {
        const { id, message } = event.payload;
        setModelStatuses((prev) => ({ ...prev, [id]: { kind: "error", message } }));
      }),
      listen<{ id: string }>("model-download-cancelled", (event) => {
        setModelStatuses((prev) => ({ ...prev, [event.payload.id]: { kind: "idle" } }));
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

  const [selectedModelId, setSelectedModelId] = useState<string>("small");

  const handleDownload = async (modelId: string) => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const dir = await open({ directory: true, title: "Choose folder to save model" });
      if (!dir || Array.isArray(dir)) return;
      await invoke("download_model", { id: modelId, destDir: dir });
    } catch (e) {
      setError(String(e));
    }
  };

  const handleCancelDownload = async (modelId: string) => {
    try {
      await invoke("cancel_download", { id: modelId });
    } catch (e) {
      setError(String(e));
    }
  };

  const handleUseModel = (path: string) => {
    setSettings((prev) => ({ ...prev, localModelPath: path }));
    setDirty(true);
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
      </header>

      {/* Error banner */}
      {error && (
        <div className="error-banner" role="alert">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Last transcript */}
      <p className="last-transcript" aria-live="polite" aria-atomic="true">
        {lastTranscript ?? ""}
      </p>

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

      {/* Local Model — only shown in Local mode */}
      {settings.transcriptionMode === "local" && (
        <section className="card" aria-labelledby="model-title">
          <span className="card-title" id="model-title">Model</span>

          {/* Model picker / downloader */}
          <div className="field">
            <label htmlFor="model-select">Select model</label>
            <select
              id="model-select"
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
            >
              {manifest.map((m) => {
                const st: ModelStatus = modelStatuses[m.id] ?? { kind: "idle" };
                const suffix =
                  st.kind === "installed"
                    ? " ✓"
                    : st.kind === "downloading" || st.kind === "validating"
                    ? " ↓"
                    : "";
                return (
                  <option key={m.id} value={m.id}>
                    {m.name} — {(m.sizeBytes / 1_073_741_824).toFixed(1)} GB{suffix}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Per-selected-model action */}
          {(() => {
            const st: ModelStatus = modelStatuses[selectedModelId] ?? { kind: "idle" };
            const selectedModel = manifest.find((m) => m.id === selectedModelId);

            if (st.kind === "idle" || st.kind === "error") {
              return (
                <div className="model-download-action">
                  {st.kind === "error" && (
                    <p className="model-error-msg" role="alert">{st.message}</p>
                  )}
                  <button
                    className="btn-download"
                    onClick={() => handleDownload(selectedModelId)}
                  >
                    {st.kind === "error" ? "Retry Download" : "Download"}
                  </button>
                </div>
              );
            }

            if (st.kind === "downloading") {
              const pct = Math.round((st.downloaded / st.total) * 100);
              const downloadedMb = (st.downloaded / 1_048_576).toFixed(0);
              const totalMb = (st.total / 1_048_576).toFixed(0);
              return (
                <div className="model-download-action">
                  <div
                    className="progress-bar"
                    role="progressbar"
                    aria-label={`Downloading ${selectedModel?.name ?? selectedModelId}`}
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="progress-meta">
                    <span>{pct}%</span>
                    <span>{downloadedMb} / {totalMb} MB</span>
                  </div>
                  <button
                    className="btn-cancel"
                    onClick={() => handleCancelDownload(selectedModelId)}
                  >
                    Cancel
                  </button>
                </div>
              );
            }

            if (st.kind === "validating") {
              return (
                <div className="model-download-action">
                  <p className="model-validating">Validating checksum…</p>
                </div>
              );
            }

            if (st.kind === "installed") {
              const installedPath = st.path;
              const isActive = settings.localModelPath === installedPath;
              return (
                <div className="model-download-action">
                  <p className="model-installed-path" title={installedPath}>
                    ✓ {installedPath.split(/[\\/]/).pop()}
                  </p>
                  {!isActive ? (
                    <button
                      className="btn-use"
                      onClick={() => handleUseModel(installedPath)}
                    >
                      Use this model
                    </button>
                  ) : (
                    <span className="model-active-label">Active</span>
                  )}
                </div>
              );
            }

            return null;
          })()}
        </section>
      )}

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
