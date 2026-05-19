import { useState, useEffect, useRef } from "react";
import { useSettingsStore } from "../store/settings";
import { saveSettings } from "../lib/invoke";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Switch } from "../components/ui/Switch";
import { HotkeyCapture } from "../components/HotkeyCapture";
import { Section } from "../components/Section";
import { CheckCircle2, Loader2, ArrowUpRight } from "lucide-react";

const CLOUD_MODELS = [
  "whisper-large-v3-turbo",
  "whisper-large-v3",
  "distil-whisper-large-v3-en",
];

const NAV_SECTIONS = [
  { id: "mode", label: "Mode" },
  { id: "audio", label: "Audio" },
  { id: "hotkey", label: "Hotkey" },
  { id: "behavior", label: "Behavior" },
  { id: "polish", label: "AI Polish" },
] as const;

type NavId = typeof NAV_SECTIONS[number]["id"];

export function Settings() {
  const { settings, devices, dirty, error, patchSetting, setSettings, setError } = useSettingsStore();
  const [saving, setSaving] = useState(false);
  const [activeNav, setActiveNav] = useState<NavId>("mode");
  const sectionRefs = useRef<Record<NavId, HTMLElement | null>>({
    mode: null,
    audio: null,
    hotkey: null,
    behavior: null,
    polish: null,
  });

  // Scroll-spy: highlight the in-page nav based on which section is most visible.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveNav(visible.target.id as NavId);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0.1, 0.5, 1] }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

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

  const scrollTo = (id: NavId) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveNav(id);
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
            Configuration
          </span>
          <h1
            className="text-[24px] font-medium text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-sans)", lineHeight: 1.2, letterSpacing: "-0.01em" }}
          >
            Settings
          </h1>
        </div>
        {!dirty && !saving && (
          <span className="inline-flex items-center gap-[6px] text-[11px] text-[var(--text-tertiary)] font-[var(--font-mono)]">
            <CheckCircle2 size={12} strokeWidth={1.6} />
            saved
          </span>
        )}
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

      <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-[var(--space-10)]">
        {/* Left rail */}
        <aside className="hidden lg:block">
          <nav aria-label="Settings sections" className="sticky top-[var(--space-4)] flex flex-col gap-[2px]">
            <span
              className="font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px] text-[var(--text-tertiary)] mb-[var(--space-3)]"
              style={{ lineHeight: 1 }}
            >
              Sections
            </span>
            {NAV_SECTIONS.map(({ id, label }) => {
              const active = activeNav === id;
              return (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className={`relative text-left text-[12px] py-[6px] px-[var(--space-3)] rounded-[var(--radius-md)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                    active
                      ? "text-[var(--text-primary)] bg-[var(--bg-raised)]"
                      : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-3 rounded-[var(--radius-sm)]"
                      style={{ background: "var(--accent)" }}
                    />
                  )}
                  {label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Mobile tabstrip */}
        <div className="lg:hidden -mx-[var(--space-6)] px-[var(--space-6)] overflow-x-auto">
          <div className="flex gap-[var(--space-2)] pb-[var(--space-3)]">
            {NAV_SECTIONS.map(({ id, label }) => {
              const active = activeNav === id;
              return (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className={`shrink-0 text-[12px] py-[6px] px-[var(--space-3)] rounded-[var(--radius-md)] border transition-colors duration-150 ${
                    active
                      ? "text-[var(--text-primary)] bg-[var(--bg-raised)] border-[var(--border)]"
                      : "text-[var(--text-tertiary)] border-[var(--border-hairline)]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sections */}
        <div className="flex flex-col gap-[var(--space-10)] pb-[120px]">
          {/* MODE */}
          <div ref={(el) => { sectionRefs.current.mode = el; }} id="mode" className="scroll-mt-[var(--space-8)]">
            <Section eyebrow="Mode" title="Transcription">
              <div className="flex flex-col gap-[var(--space-5)]">
                <div className="flex flex-col gap-[var(--space-2)]">
                  <ModePill
                    options={[
                      { id: "cloud", label: "Cloud", desc: "Groq API. Fast, requires internet." },
                      { id: "local", label: "Local", desc: "On-device Whisper. Private, slower." },
                    ]}
                    value={settings.transcriptionMode}
                    onChange={(v) => patchSetting("transcriptionMode", v as "cloud" | "local")}
                  />
                </div>

                {settings.transcriptionMode === "cloud" && (
                  <div className="flex flex-col gap-[var(--space-4)] pl-[var(--space-4)] border-l border-[var(--border-hairline)]">
                    <PrivacyNote />
                    <Field label="Model" hint="whisper-large-v3-turbo recommended for speed">
                      <Select
                        value={settings.cloudModel}
                        onChange={(e) => patchSetting("cloudModel", e.target.value)}
                      >
                        {CLOUD_MODELS.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Groq API key" hint="Stored locally in your app data">
                      <Input
                        type="password"
                        autoComplete="off"
                        placeholder="gsk_..."
                        value={settings.groqApiKey ?? ""}
                        onChange={(e) => patchSetting("groqApiKey", e.target.value || null)}
                      />
                    </Field>
                  </div>
                )}

                {settings.transcriptionMode === "local" && (
                  <div className="flex flex-col gap-[var(--space-2)] pl-[var(--space-4)] border-l border-[var(--border-hairline)]">
                    <p className="text-[12px] text-[var(--text-secondary)]">
                      Manage local Whisper models on the{" "}
                      <button
                        onClick={() => (window.location.hash = "/models")}
                        className="text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:underline"
                      >
                        Models
                      </button>{" "}
                      page.
                    </p>
                    {settings.localModelPath && (
                      <p className="text-[11px] text-[var(--text-tertiary)] font-[var(--font-mono)] truncate" title={settings.localModelPath}>
                        active: {settings.localModelPath.split(/[\\/]/).pop()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </Section>
          </div>

          {/* AUDIO */}
          <div ref={(el) => { sectionRefs.current.audio = el; }} id="audio" className="scroll-mt-[var(--space-8)]">
            <Section eyebrow="Audio" title="Microphone input">
              <Field label="Microphone" hint="Default uses Windows' currently selected device">
                <Select
                  value={settings.micDeviceId ?? "default"}
                  onChange={(e) =>
                    patchSetting("micDeviceId", e.target.value === "default" ? null : e.target.value)
                  }
                >
                  <option value="default">System default</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}{d.isDefault ? " (system default)" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            </Section>
          </div>

          {/* HOTKEY */}
          <div ref={(el) => { sectionRefs.current.hotkey = el; }} id="hotkey" className="scroll-mt-[var(--space-8)]">
            <Section eyebrow="Hotkey" title="Trigger">
              <div className="flex flex-col gap-[var(--space-5)]">
                <ModePill
                  options={[
                    { id: "toggle", label: "Toggle", desc: "Press once to start, again to stop." },
                    { id: "pushToTalk", label: "Push to talk", desc: "Hold while speaking, release to send." },
                  ]}
                  value={settings.hotkeyMode}
                  onChange={(v) => patchSetting("hotkeyMode", v as "toggle" | "pushToTalk")}
                />
                <Field label="Key combination" hint="Click then press your desired keys">
                  <HotkeyCapture
                    value={settings.hotkey}
                    onChange={(combo) => patchSetting("hotkey", combo)}
                  />
                </Field>
              </div>
            </Section>
          </div>

          {/* BEHAVIOR */}
          <div ref={(el) => { sectionRefs.current.behavior = el; }} id="behavior" className="scroll-mt-[var(--space-8)]">
            <Section eyebrow="Behavior" title="App lifecycle">
              <Row
                label="Start with Windows"
                desc="Launch Ello on login and run quietly in the tray."
              >
                <Switch
                  checked={settings.autostartEnabled}
                  onChange={(v) => patchSetting("autostartEnabled", v)}
                  label="Start with Windows"
                />
              </Row>
            </Section>
          </div>

          {/* AI POLISH */}
          <div ref={(el) => { sectionRefs.current.polish = el; }} id="polish" className="scroll-mt-[var(--space-8)]">
            <Section eyebrow="Polish" title="AI cleanup">
              <Row
                label="AI Polish"
                desc="Remove filler words, fix grammar, or reformat transcripts with an LLM."
              >
                <button
                  onClick={() => (window.location.hash = "/ai-polish")}
                  className="group inline-flex items-center gap-[6px] text-[12px] text-[var(--accent)] hover:text-[var(--text-primary)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded"
                >
                  Configure
                  <ArrowUpRight size={12} strokeWidth={1.6} className="transition-transform duration-150 group-hover:translate-x-[1px] group-hover:-translate-y-[1px]" />
                </button>
              </Row>
            </Section>
          </div>
        </div>
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
          className="pointer-events-auto mx-auto max-w-[1080px] px-[var(--space-6)] sm:px-[var(--space-10)] pb-[var(--space-5)]"
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

function ModePill<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; desc?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-[var(--space-2)]">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            className={`relative text-left rounded-[var(--radius-md)] border px-[var(--space-4)] py-[var(--space-3)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-base)] ${
              active
                ? "bg-[var(--bg-raised)] border-[var(--border)]"
                : "bg-transparent border-[var(--border-hairline)] hover:border-[var(--border)] hover:bg-[var(--bg-raised)]"
            }`}
          >
            <div className="flex items-center gap-[var(--space-2)] mb-[2px]">
              <span
                className="block w-[6px] h-[6px] rounded-full transition-colors duration-150"
                style={{ background: active ? "var(--accent)" : "var(--text-ghost)" }}
              />
              <span
                className={`text-[12px] font-medium ${active ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}
              >
                {opt.label}
              </span>
            </div>
            {opt.desc && (
              <p className="text-[11px] text-[var(--text-tertiary)] leading-snug">{opt.desc}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function PrivacyNote() {
  return (
    <p className="text-[11px] text-[var(--text-tertiary)] font-[var(--font-mono)] leading-relaxed">
      Cloud mode uploads recorded audio to Groq for transcription. No audio is
      stored after the request returns.
    </p>
  );
}
