import { useState, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import { Section } from "../components/Section";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Switch } from "../components/ui/Switch";
import { toast } from "../components/ui/Toast";
import { useSettingsStore } from "../store/settings";
import { saveSettings, historyList, polishTest } from "../lib/invoke";

const POLISH_MODELS = [
  { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (versatile)" },
  { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B (instant)" },
  { value: "llama-3.1-70b-versatile", label: "Llama 3.1 70B (versatile)" },
  { value: "custom", label: "CustomΓÇª" },
];

const PROMPT_TEMPLATES = [
  { label: "Remove filler words", value: "Remove filler words and fix grammar without changing meaning." },
  { label: "Format as email", value: "Format this transcript as a professional email." },
  { label: "Convert to bullets", value: "Convert this transcript into a concise bullet-point list." },
];

export function AiPolish() {
  const { settings, dirty, patchSetting, setSettings, setError } = useSettingsStore();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testRaw, setTestRaw] = useState<string | null>(null);
  const [testPolished, setTestPolished] = useState<string | null>(null);

  const polish = settings.aiPolish;
  const isCustomModel = !POLISH_MODELS.slice(0, -1).some((m) => m.value === polish.model);
  const selectedModelValue = isCustomModel ? "custom" : polish.model;
  const needsApiKey = !settings.groqApiKey;

  const patchPolish = useCallback(
    (patch: Partial<typeof polish>) => {
      patchSetting("aiPolish", { ...polish, ...patch });
    },
    [polish, patchSetting]
  );

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveSettings(settings);
      setSettings(settings);
    } catch (e) {
      setError(String(e));
      toast(String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestRaw(null);
    setTestPolished(null);
    try {
      const items = await historyList(null, 1, 0);
      if (items.length === 0) {
        toast("No transcripts yet");
        return;
      }
      const raw = items[0].text;
      setTestRaw(raw);
      const polished = await polishTest(raw);
      setTestPolished(polished);
    } catch (e) {
      toast(String(e), "error");
    } finally {
      setTesting(false);
    }
  }, []);

  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      {/* Page header */}
      <div className="flex flex-col gap-[var(--space-1)]">
        <span
          className="font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px] text-[var(--text-tertiary)]"
          style={{ lineHeight: 1 }}
        >
          Cleanup
        </span>
        <h1
          className="text-[24px] font-medium text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-sans)", lineHeight: 1.2, letterSpacing: "-0.01em" }}
        >
          AI Polish
        </h1>
      </div>

      {/* Enable */}
      <Section eyebrow="Status" title="Enable AI polish">
        <div className="flex flex-col gap-[var(--space-4)]">
          <div className="flex items-center justify-between gap-[var(--space-4)]">
            <div className="flex flex-col gap-[var(--space-1)]">
              <span className="text-[13px] text-[var(--text-primary)]">Run AI polish after transcription</span>
              <span className="text-[12px] text-[var(--text-tertiary)]">
                Passes the transcript through an LLM before typing it into your active window.
              </span>
            </div>
            <Switch
              checked={polish.enabled}
              onChange={(v) => patchPolish({ enabled: v })}
              label="Enable AI polish"
            />
          </div>
          {needsApiKey && (
            <div className="flex items-start gap-[var(--space-2)]">
              <AlertTriangle
                size={13}
                strokeWidth={1.6}
                className="shrink-0 mt-[2px] text-[var(--accent)]"
                aria-hidden="true"
              />
              <span className="text-[12px] text-[var(--accent)]">
                AI polish uses your Groq API key. Set it in{" "}
                <button
                  onClick={() => (window.location.hash = "/settings")}
                  className="underline underline-offset-2 hover:text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded"
                >
                  Settings ΓåÆ Cloud
                </button>
                .
              </span>
            </div>
          )}
        </div>
      </Section>

      {/* Model ΓÇö only shown when enabled */}
      {polish.enabled && (
        <Section eyebrow="Model" title="Language model">
          <div className="flex flex-col gap-[var(--space-3)]">
            <Select
              value={selectedModelValue}
              onChange={(e) => {
                if (e.target.value !== "custom") {
                  patchPolish({ model: e.target.value });
                } else {
                  patchPolish({ model: "" });
                }
              }}
              aria-label="Select polish model"
            >
              {POLISH_MODELS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </Select>
            {isCustomModel && (
              <Input
                value={polish.model}
                onChange={(e) => patchPolish({ model: e.target.value })}
                placeholder="e.g. mixtral-8x7b-32768"
                aria-label="Custom model ID"
              />
            )}
          </div>
        </Section>
      )}

      {/* Prompt ΓÇö only shown when enabled */}
      {polish.enabled && (
        <Section eyebrow="Prompt" title="System prompt">
          <div className="flex flex-col gap-[var(--space-3)]">
            <textarea
              value={polish.prompt}
              onChange={(e) => patchPolish({ prompt: e.target.value })}
              rows={6}
              aria-label="AI polish system prompt"
              className="w-full bg-[var(--bg-raised)] border border-[var(--border)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus-visible:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] transition-colors duration-150 resize-none"
            />
            <div className="flex flex-wrap gap-[var(--space-2)]">
              {PROMPT_TEMPLATES.map((t) => (
                <Button
                  key={t.value}
                  size="sm"
                  variant="ghost"
                  onClick={() => patchPolish({ prompt: t.value })}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* Threshold ΓÇö only shown when enabled */}
      {polish.enabled && (
        <Section eyebrow="Threshold" title="Minimum word count">
          <div className="flex flex-col gap-[var(--space-3)]">
            <div className="flex items-center gap-[var(--space-4)]">
              <input
                type="range"
                min={0}
                max={50}
                value={polish.minWordCount}
                onChange={(e) => patchPolish({ minWordCount: Number(e.target.value) })}
                aria-label="Minimum word count"
                className="flex-1 accent-[var(--accent)] cursor-pointer"
              />
              <span className="font-[var(--font-mono)] text-[13px] text-[var(--text-primary)] w-[28px] text-right tabular-nums">
                {polish.minWordCount}
              </span>
            </div>
            <p className="text-[12px] text-[var(--text-tertiary)]">
              Polish is skipped for transcripts shorter than this.
            </p>
          </div>
        </Section>
      )}

      {/* Test */}
      <Section eyebrow="Test" title="Test on last transcript">
        <div className="flex flex-col gap-[var(--space-4)]">
          <div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleTest}
              disabled={testing}
              aria-busy={testing}
            >
              {testing ? "TestingΓÇª" : "Test on last transcript"}
            </Button>
          </div>
          {(testRaw !== null || testPolished !== null) && (
            <div className="grid grid-cols-2 gap-[var(--space-4)]">
              <div className="flex flex-col gap-[var(--space-2)]">
                <span className="text-[11px] text-[var(--text-tertiary)] font-[var(--font-mono)] uppercase tracking-[0.12em]">
                  Raw
                </span>
                <textarea
                  value={testRaw ?? ""}
                  readOnly
                  rows={5}
                  aria-label="Raw transcript"
                  className="w-full bg-[var(--bg-sunken)] border border-[var(--border-hairline)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-[13px] text-[var(--text-secondary)] outline-none resize-none font-[var(--font-mono)] cursor-default"
                />
              </div>
              <div className="flex flex-col gap-[var(--space-2)]">
                <span className="text-[11px] text-[var(--text-tertiary)] font-[var(--font-mono)] uppercase tracking-[0.12em]">
                  Polished
                </span>
                <textarea
                  value={testPolished ?? ""}
                  readOnly
                  rows={5}
                  aria-label="Polished transcript"
                  className="w-full bg-[var(--bg-sunken)] border border-[var(--border-hairline)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-[13px] text-[var(--text-secondary)] outline-none resize-none font-[var(--font-mono)] cursor-default"
                />
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Sticky save bar */}
      <div
        aria-hidden={!dirty}
        className={`fixed bottom-0 left-[56px] right-0 pointer-events-none transition-opacity duration-200 ${
          dirty ? "opacity-100" : "opacity-0"
        }`}
        style={{ zIndex: 40 }}
      >
        <div
          className="pointer-events-auto mx-auto max-w-[680px] px-[var(--space-6)] sm:px-[var(--space-10)] pb-[var(--space-5)]"
          style={dirty ? { animation: "save-bar-in 220ms var(--ease-out-quart)" } : undefined}
        >
          <div className="flex items-center justify-between gap-[var(--space-4)] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-lg)] px-[var(--space-4)] py-[var(--space-3)] shadow-lg">
            <span className="text-[12px] text-[var(--text-secondary)]">You have unsaved changes.</span>
            <Button variant="solid" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "SavingΓÇª" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
