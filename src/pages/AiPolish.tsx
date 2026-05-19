import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useSettingsStore } from "../store/settings";
import { saveSettings, polishTest } from "../lib/invoke";
import type { PolishTestResult } from "../lib/invoke";
import { Section } from "../components/Section";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Switch } from "../components/ui/Switch";

const POLISH_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
];

const STARTER_TEMPLATES = [
  "Remove filler words",
  "Format as email",
  "Convert to bullet list",
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      <div className="flex items-baseline justify-between gap-[var(--space-3)]">
        <label className="text-[12px] text-[var(--text-primary)]">{label}</label>
        {hint && <span className="text-[10px] text-[var(--text-tertiary)] font-[var(--font-mono)]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-[var(--space-4)] py-[var(--space-2)]">
      <div className="flex flex-col gap-[2px] min-w-0">
        <span className="text-[12px] text-[var(--text-primary)]">{label}</span>
        {desc && <span className="text-[11px] text-[var(--text-tertiary)]">{desc}</span>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function AiPolish() {
  const { settings, dirty, error, patchSetting, setSettings, setError } = useSettingsStore();
  const lastTranscript = useSettingsStore((s) => s.lastTranscript);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<PolishTestResult | null>(null);

  const polish = settings.aiPolish;
  const needsGroq =
    settings.transcriptionMode !== "cloud" || !settings.groqApiKey;

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

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await polishTest();
      setTestResult(result);
    } catch (e) {
      setTestResult({ before: lastTranscript ?? "", after: "", error: String(e) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="relative">
      {/* Page header */}
      <div className="flex items-end justify-between mb-[var(--space-6)]">
        <div className="flex flex-col gap-[var(--space-1)]">
          <span
            className="font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px] text-[var(--text-tertiary)]"
            style={{ lineHeight: 1 }}
          >
            Post-processing
          </span>
          <h1
            className="text-[24px] font-medium text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-sans)", lineHeight: 1.2, letterSpacing: "-0.01em" }}
          >
            AI Polish
          </h1>
        </div>
        <Sparkles size={20} strokeWidth={1.6} className="text-[var(--text-tertiary)]" aria-hidden="true" />
      </div>

      {error && (
        <div
          role="alert"
          className="mb-[var(--space-6)] flex items-start gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-3)] bg-[var(--bg-raised)] border border-[var(--color-error-border)] rounded-[var(--radius-md)] text-[12px] font-[var(--font-mono)] text-[var(--color-error)]"
        >
          <span className="uppercase tracking-[0.14em] text-[10px] mt-[2px]">Err</span>
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-[var(--space-10)] pb-[120px]">
        {/* ENABLE */}
        <Section eyebrow="Enable" title="AI polish">
          <div className="flex flex-col gap-[var(--space-4)]">
            <Row
              label="Enable AI polish"
              desc="Run transcripts through an LLM to clean up filler and grammar."
            >
              <Switch
                checked={polish.enabled}
                onChange={(v) => patchSetting("aiPolish", { ...polish, enabled: v })}
                label="Enable AI polish"
              />
            </Row>
            {!polish.enabled && (
              <p className="text-[11px] text-[var(--text-tertiary)] font-[var(--font-mono)]">
                Polish is off. Recordings type the raw transcript.
              </p>
            )}
            {needsGroq && (
              <p className="text-[11px] text-[var(--text-tertiary)] font-[var(--font-mono)]">
                AI polish requires a Groq API key. Configure it in{" "}
                <button
                  onClick={() => (window.location.hash = "/settings")}
                  className="text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:underline"
                >
                  Settings → Mode
                </button>
                .
              </p>
            )}
          </div>
        </Section>

        {/* MODEL */}
        <Section eyebrow="Model" title="Language model">
          <Field label="Model">
            <Select
              value={polish.model}
              onChange={(e) => patchSetting("aiPolish", { ...polish, model: e.target.value })}
              disabled={!polish.enabled}
              className={!polish.enabled ? "opacity-40 cursor-not-allowed" : ""}
            >
              {POLISH_MODELS.map((m) => (
                <option key={m} value={m} style={{ fontFamily: "var(--font-mono)" }}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
        </Section>

        {/* PROMPT */}
        <Section eyebrow="Prompt" title="Instructions">
          <div className="flex flex-col gap-[var(--space-4)]">
            <Field label="Prompt" hint="Instructions sent to the model before your transcript">
              <textarea
                value={polish.prompt}
                onChange={(e) => patchSetting("aiPolish", { ...polish, prompt: e.target.value })}
                disabled={!polish.enabled}
                rows={3}
                className={`w-full resize-y bg-[var(--bg-raised)] border border-[var(--border)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-[13px] text-[var(--text-primary)] outline-none focus-visible:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] transition-colors duration-150 font-[var(--font-mono)] leading-relaxed ${
                  !polish.enabled ? "opacity-40 cursor-not-allowed" : ""
                }`}
              />
            </Field>
            <div className="flex flex-wrap gap-[var(--space-2)]">
              {STARTER_TEMPLATES.map((tpl) => (
                <Button
                  key={tpl}
                  variant="ghost"
                  size="sm"
                  disabled={!polish.enabled}
                  onClick={() => patchSetting("aiPolish", { ...polish, prompt: tpl })}
                >
                  {tpl}
                </Button>
              ))}
            </div>
          </div>
        </Section>

        {/* MIN WORD COUNT */}
        <Section eyebrow="Filter" title="Minimum word count">
          <Field
            label={`Minimum word count — ${polish.minWordCount} words`}
            hint="Skip polish for short transcripts"
          >
            <input
              type="range"
              min={1}
              max={50}
              step={1}
              value={polish.minWordCount}
              disabled={!polish.enabled}
              onChange={(e) =>
                patchSetting("aiPolish", { ...polish, minWordCount: Number(e.target.value) })
              }
              className={`w-full h-[4px] rounded-full appearance-none bg-[var(--bg-raised)] accent-[var(--accent)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)] ${
                !polish.enabled ? "opacity-40 cursor-not-allowed" : ""
              }`}
            />
          </Field>
        </Section>

        {/* TEST */}
        <Section eyebrow="Test" title="Last transcript">
          <div className="flex flex-col gap-[var(--space-4)]">
            <div className="flex items-center gap-[var(--space-3)]">
              <Button
                variant="default"
                onClick={handleTest}
                disabled={lastTranscript === null || testing}
              >
                {testing ? (
                  <span className="inline-flex items-center gap-[6px]">
                    <Loader2 size={12} strokeWidth={1.6} className="animate-spin" />
                    Running
                  </span>
                ) : (
                  "Run test"
                )}
              </Button>
              {lastTranscript === null && (
                <span className="text-[11px] text-[var(--text-tertiary)] font-[var(--font-mono)]">
                  No transcript yet — record something first.
                </span>
              )}
            </div>

            {testResult && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-4)]">
                <div className="flex flex-col gap-[var(--space-2)]">
                  <span className="text-[10px] font-[var(--font-mono)] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    Before
                  </span>
                  <div className="bg-[var(--bg-raised)] border border-[var(--border-hairline)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-3)] text-[12px] font-[var(--font-mono)] text-[var(--text-secondary)] leading-relaxed min-h-[80px]">
                    {testResult.before}
                  </div>
                </div>
                <div className="flex flex-col gap-[var(--space-2)]">
                  <span className="text-[10px] font-[var(--font-mono)] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    After
                  </span>
                  {testResult.error ? (
                    <div className="bg-[var(--bg-raised)] border border-[var(--border-hairline)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-3)] text-[12px] font-[var(--font-mono)] text-[var(--color-warning,#d97706)] leading-relaxed min-h-[80px]">
                      {testResult.error}
                    </div>
                  ) : (
                    <div className="bg-[var(--bg-raised)] border border-[var(--border-hairline)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-3)] text-[12px] font-[var(--font-mono)] text-[var(--text-secondary)] leading-relaxed min-h-[80px]">
                      {testResult.after}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* Sticky save bar */}
      <div
        aria-hidden={!dirty}
        className={`fixed bottom-0 left-[56px] right-0 pointer-events-none transition-opacity duration-200 ${
          dirty ? "opacity-100" : "opacity-0"
        }`}
        style={{ zIndex: 40 }}
      >
        <div
          className="pointer-events-auto mx-auto max-w-[720px] px-[var(--space-6)] sm:px-[var(--space-10)] pb-[var(--space-5)]"
          style={dirty ? { animation: "save-bar-in 220ms var(--ease-out-quart)" } : undefined}
        >
          <div className="flex items-center justify-between gap-[var(--space-4)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] px-[var(--space-5)] py-[var(--space-3)] shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-[var(--space-3)]">
              <span className="block w-[6px] h-[6px] rounded-full" style={{ background: "var(--accent)" }} />
              <span className="text-[12px] text-[var(--text-secondary)]">Unsaved changes.</span>
            </div>
            <Button onClick={handleSave} disabled={saving} variant="default">
              {saving ? (
                <span className="inline-flex items-center gap-[6px]">
                  <Loader2 size={12} strokeWidth={1.6} className="animate-spin" />
                  Saving
                </span>
              ) : (
                "Save settings"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
