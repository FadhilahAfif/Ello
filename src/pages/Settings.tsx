import { useState } from "react";
import { useSettingsStore } from "../store/settings";
import { saveSettings } from "../lib/invoke";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Switch } from "../components/ui/Switch";
import { HotkeyCapture } from "../components/HotkeyCapture";

const CLOUD_MODELS = [
  "whisper-large-v3-turbo",
  "whisper-large-v3",
  "distil-whisper-large-v3-en",
];

export function Settings() {
  const { settings, devices, dirty, error, patchSetting, setSettings, setError } = useSettingsStore();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveSettings(settings);
      setSettings(settings);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-[var(--space-6)] flex flex-col gap-[var(--space-4)] max-w-xl">
      <h1 className="text-[20px] font-medium text-[var(--text-primary)]">Settings</h1>

      {error && (
        <div role="alert" className="flex items-start gap-[var(--space-2)] px-[var(--space-3)] py-[var(--space-2)] bg-[var(--bg-raised)] border border-[var(--color-error-border)] rounded-[var(--radius-lg)] text-[13px] text-[var(--color-error)]">
          <span>⚠</span><span>{error}</span>
        </div>
      )}

      <Card>
        <p className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-[0.14em] mb-[var(--space-3)]">Transcription mode</p>
        <div className="flex border border-[var(--border)] rounded-[var(--radius-md)] overflow-hidden mb-[var(--space-3)]" role="group" aria-label="Transcription mode">
          {(["cloud", "local"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => patchSetting("transcriptionMode", mode)}
              aria-pressed={settings.transcriptionMode === mode}
              className={`flex-1 py-[var(--space-2)] text-[13px] font-medium transition-colors border-0 cursor-pointer capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset ${
                settings.transcriptionMode === mode
                  ? "bg-[var(--accent)] text-[var(--bg-base)]"
                  : "bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {settings.transcriptionMode === "cloud" && (
          <div className="flex flex-col gap-[var(--space-3)]">
            <div role="note" className="px-[var(--space-3)] py-[var(--space-2)] bg-[var(--bg-sunken)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-[11px] text-[var(--text-tertiary)]">
              Cloud mode sends audio to Groq's servers for transcription.
            </div>
            <div className="flex flex-col gap-[var(--space-1)]">
              <label htmlFor="cloud-model" className="text-[13px] text-[var(--text-secondary)]">Model</label>
              <Select id="cloud-model" value={settings.cloudModel} onChange={(e) => patchSetting("cloudModel", e.target.value)}>
                {CLOUD_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </div>
            <div className="flex flex-col gap-[var(--space-1)]">
              <label htmlFor="groq-key" className="text-[13px] text-[var(--text-secondary)]">Groq API key</label>
              <Input
                id="groq-key"
                type="password"
                autoComplete="off"
                placeholder="gsk_…"
                value={settings.groqApiKey ?? ""}
                onChange={(e) => patchSetting("groqApiKey", e.target.value || null)}
              />
            </div>
          </div>
        )}
      </Card>

      <Card>
        <p className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-[0.14em] mb-[var(--space-3)]">Audio input</p>
        <div className="flex flex-col gap-[var(--space-1)]">
          <label htmlFor="mic-device" className="text-[13px] text-[var(--text-secondary)]">Microphone</label>
          <Select
            id="mic-device"
            value={settings.micDeviceId ?? "default"}
            onChange={(e) => patchSetting("micDeviceId", e.target.value === "default" ? null : e.target.value)}
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>{d.name}{d.isDefault ? " (default)" : ""}</option>
            ))}
          </Select>
        </div>
      </Card>

      <Card>
        <p className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-[0.14em] mb-[var(--space-3)]">Hotkey</p>
        <div className="flex border border-[var(--border)] rounded-[var(--radius-md)] overflow-hidden mb-[var(--space-3)]" role="group" aria-label="Hotkey mode">
          {(["toggle", "pushToTalk"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => patchSetting("hotkeyMode", mode)}
              aria-pressed={settings.hotkeyMode === mode}
              className={`flex-1 py-[var(--space-2)] text-[13px] font-medium transition-colors border-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset ${
                settings.hotkeyMode === mode
                  ? "bg-[var(--accent)] text-[var(--bg-base)]"
                  : "bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {mode === "toggle" ? "Toggle" : "Push to Talk"}
            </button>
          ))}
        </div>
        <HotkeyCapture value={settings.hotkey} onChange={(combo) => patchSetting("hotkey", combo)} />
      </Card>

      <Card>
        <p className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-[0.14em] mb-[var(--space-3)]">App behaviour</p>
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-[var(--text-secondary)]">Start with Windows</span>
          <Switch
            checked={settings.autostartEnabled}
            onChange={(v) => patchSetting("autostartEnabled", v)}
            label="Start with Windows"
          />
        </div>
      </Card>

      <Card>
        <p className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-[0.14em] mb-[var(--space-3)]">AI polish</p>
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-[var(--text-secondary)]">Enable AI polish</span>
          <Switch checked={false} onChange={() => {}} label="Enable AI polish" />
        </div>
        <p className="text-[11px] text-[var(--text-ghost)] mt-[var(--space-2)]">Coming in a future update.</p>
      </Card>

      <Button onClick={handleSave} disabled={!dirty || saving} className="w-full">
        {saving ? "Saving…" : dirty ? "Save settings" : "Saved"}
      </Button>
    </div>
  );
}
