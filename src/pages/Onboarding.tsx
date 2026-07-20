import { useState, useEffect, useRef } from "react";
import { toast } from "../components/ui/Toast";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { useSettingsStore } from "../store/settings";
import { saveSettings, recordMicTest, getModelManifest, downloadModel, cancelDownload, checkInstalledModels, setGroqApiKey, getSettings } from "../lib/invoke";
import type { ModelManifestEntry } from "../lib/invoke";
import type { ModelStatus } from "../store/settings";
import { navigate } from "../app/router";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Wordmark } from "../components/ui/Wordmark";
import { CursorBlock } from "../components/ui/CursorBlock";
import { HotkeyCapture } from "../components/HotkeyCapture";
import {
  onModelDownloadProgress, onModelDownloadDone,
  onModelDownloadError, onModelDownloadCancelled,
} from "../lib/events";
import { Check, Download, X, Loader2, Mic, RotateCcw, ChevronRight } from "lucide-react";

type Step = 0 | 1 | 2 | 3 | 4 | 5;

const STEP_LABELS = ["Welcome", "Mode", "Setup", "Hotkey", "Mic test", "Done"];

const formatBytes = (bytes: number): string => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1_048_576).toFixed(0)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
};

export function Onboarding() {
  const [step, setStep] = useState<Step>(0);
  const { settings, patchSetting, setSettings } = useSettingsStore();

  const advance = () => setStep((s) => Math.min(s + 1, 5) as Step);

  const persistAndAdvance = async (patches: Partial<typeof settings> = {}) => {
    const next = { ...settings, ...patches };
    try {
      await saveSettings(next);
      for (const [k, v] of Object.entries(patches)) {
        patchSetting(k as keyof typeof settings, v as never);
      }
      advance();
    } catch (e) {
      toast(String(e), "error");
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-48px)] py-[var(--space-10)]">
      <StepBar current={step} />
      <div className="flex-1 flex flex-col justify-center" style={{ animation: "fade-up 240ms var(--ease-out-quart)" }} key={step}>
        {step === 0 && <StepWelcome onNext={advance} />}
        {step === 1 && <StepMode onNext={persistAndAdvance} />}
        {step === 2 && (
          settings.transcriptionMode === "cloud"
            ? <StepApiKey onNext={persistAndAdvance} />
            : <StepLocalModel onNext={persistAndAdvance} />
        )}
        {step === 3 && <StepHotkey onNext={persistAndAdvance} />}
        {step === 4 && <StepMicTest onNext={advance} />}
        {step === 5 && <StepDone onFinish={async () => {
          const next = { ...settings, onboardingComplete: true };
          try { await saveSettings(next); } catch {}
          patchSetting("onboardingComplete", true);
          setSettings({ ...useSettingsStore.getState().settings, onboardingComplete: true });
          navigate("/dashboard");
        }} />}
      </div>
    </div>
  );
}

function StepBar({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-10)]">
      {STEP_LABELS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center gap-[var(--space-2)]">
            <div className="flex items-center gap-[var(--space-2)]">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-[var(--font-mono)] transition-colors duration-200 ${
                  done
                    ? "bg-[var(--accent)] text-[var(--bg-base)]"
                    : active
                    ? "border border-[var(--accent)] text-[var(--accent)]"
                    : "border border-[var(--border-hairline)] text-[var(--text-ghost)]"
                }`}
              >
                {done ? <Check size={10} strokeWidth={2} /> : i + 1}
              </span>
              <span
                className={`text-[11px] font-[var(--font-mono)] hidden sm:block ${
                  active ? "text-[var(--text-primary)]" : done ? "text-[var(--text-secondary)]" : "text-[var(--text-ghost)]"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <span className="w-6 h-px bg-[var(--border-hairline)]" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      <Wordmark size="lg" />
      <div className="flex flex-col gap-[var(--space-4)]">
        <h1
          className="text-[32px] font-medium text-[var(--text-primary)] flex items-baseline gap-[var(--space-2)]"
          style={{ fontFamily: "var(--font-sans)", lineHeight: 1.1, letterSpacing: "-0.02em" }}
        >
          Welcome
          <CursorBlock size="lg" animate="pulse" />
        </h1>
        <p className="text-[13px] text-[var(--text-secondary)]" style={{ maxWidth: "52ch", lineHeight: 1.7 }}>
          Ello turns your voice into a cursor. Press a hotkey, speak, and what you said gets typed into the active window.
        </p>
        <p className="text-[13px] text-[var(--text-secondary)]" style={{ maxWidth: "52ch", lineHeight: 1.7 }}>
          This wizard takes about two minutes. You can change everything later in Settings.
        </p>
      </div>
      <div>
        <Button onClick={onNext} variant="default">
          Get started
          <ChevronRight size={13} strokeWidth={1.6} className="ml-[6px]" />
        </Button>
      </div>
    </div>
  );
}

function StepMode({ onNext }: { onNext: (patches: Record<string, unknown>) => void }) {
  const { settings } = useSettingsStore();
  const [mode, setMode] = useState(settings.transcriptionMode);

  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      <div className="flex flex-col gap-[var(--space-3)]">
        <span className="font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px] text-[var(--text-tertiary)]" style={{ lineHeight: 1 }}>Step 2 of 6</span>
        <h2 className="text-[24px] font-medium text-[var(--text-primary)]" style={{ fontFamily: "var(--font-sans)", lineHeight: 1.2, letterSpacing: "-0.01em" }}>Pick a transcription mode</h2>
        <p className="text-[13px] text-[var(--text-secondary)]" style={{ maxWidth: "52ch", lineHeight: 1.6 }}>You can switch modes any time in Settings.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-3)]">
        {([
          { id: "cloud", label: "Cloud", sub: "Groq API", desc: "Fast and accurate, but uploads audio to Groq. Ello deletes its temporary WAV after the request." },
          { id: "local", label: "Local", sub: "Whisper on-device", desc: "Private, no internet needed. Slower first run while the model loads." },
        ] as const).map(({ id, label, sub, desc }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              onClick={() => setMode(id)}
              aria-pressed={active}
              className={`text-left rounded-[var(--radius-lg)] border px-[var(--space-5)] py-[var(--space-5)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-base)] ${
                active ? "bg-[var(--bg-raised)] border-[var(--border)]" : "bg-transparent border-[var(--border-hairline)] hover:border-[var(--border)] hover:bg-[var(--bg-raised)]"
              }`}
            >
              <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-2)]">
                <span className="block w-[6px] h-[6px] rounded-full transition-colors duration-150" style={{ background: active ? "var(--accent)" : "var(--text-ghost)" }} />
                <span className={`text-[14px] font-medium ${active ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>{label}</span>
                <span className="text-[10px] font-[var(--font-mono)] text-[var(--text-tertiary)]">{sub}</span>
              </div>
              <p className="text-[12px] text-[var(--text-tertiary)] leading-snug">{desc}</p>
            </button>
          );
        })}
      </div>
      <div>
        <Button onClick={() => onNext({ transcriptionMode: mode })} variant="default">
          Continue
          <ChevronRight size={13} strokeWidth={1.6} className="ml-[6px]" />
        </Button>
      </div>
    </div>
  );
}

function StepApiKey({ onNext }: { onNext: (patches: Record<string, unknown>) => Promise<void> }) {
  const { settings } = useSettingsStore();
  const [key, setKey] = useState("");
  const [model, setModel] = useState(settings.cloudModel);
  const [acknowledged, setAcknowledged] = useState(settings.cloudUploadAcknowledged);
  const [saving, setSaving] = useState(false);

  const CLOUD_MODELS = ["whisper-large-v3-turbo", "whisper-large-v3"];

  const handleContinue = async () => {
    setSaving(true);
    try {
      if (key.trim()) await setGroqApiKey(key);
      await onNext({ cloudModel: model, cloudUploadAcknowledged: acknowledged });
      useSettingsStore.getState().setSettings(await getSettings());
    } catch (e) {
      toast(String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      <div className="flex flex-col gap-[var(--space-3)]">
        <span className="font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px] text-[var(--text-tertiary)]" style={{ lineHeight: 1 }}>Step 3 of 6 — Cloud</span>
        <h2 className="text-[24px] font-medium text-[var(--text-primary)]" style={{ fontFamily: "var(--font-sans)", lineHeight: 1.2, letterSpacing: "-0.01em" }}>Groq API key</h2>
      </div>
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-sunken)] px-[var(--space-5)] py-[var(--space-4)]">
        <p className="text-[11px] font-[var(--font-mono)] text-[var(--text-tertiary)] leading-relaxed">
          Cloud mode sends recorded audio to Groq for transcription. Ello deletes its temporary WAV after the request. Groq may retain inference data for up to 30 days for reliability and abuse monitoring unless Zero Data Retention is enabled for your account. Your key is stored in Windows Credential Manager.
        </p>
      </div>
      <div className="flex flex-col gap-[var(--space-5)]">
        <div className="flex flex-col gap-[var(--space-2)]">
          <label htmlFor="onboarding-api-key" className="text-[12px] text-[var(--text-primary)]">API key</label>
          <Input
            id="onboarding-api-key"
            type="password"
            autoComplete="off"
            placeholder="gsk_..."
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <span className="text-[10px] text-[var(--text-tertiary)] font-[var(--font-mono)]">Get a free key at console.groq.com</span>
        </div>
        <div className="flex flex-col gap-[var(--space-2)]">
          <label htmlFor="onboarding-cloud-model" className="text-[12px] text-[var(--text-primary)]">Model</label>
          <select
            id="onboarding-cloud-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-[12px] text-[var(--text-primary)] focus-visible:outline-none focus-visible:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
          >
            {CLOUD_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
      <label className="flex items-start gap-[var(--space-3)] text-[11px] text-[var(--text-secondary)] leading-relaxed">
        <input
          type="checkbox"
          className="mt-[2px] accent-[var(--accent)] rounded-[var(--radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-base)]"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
        />
        <span>I understand that Cloud mode uploads my recorded audio to Groq under the retention terms above.</span>
      </label>
      <div className="flex items-center gap-[var(--space-3)]">
        <Button onClick={handleContinue} variant="default" disabled={saving || !acknowledged || (!key.trim() && !settings.groqApiKeyConfigured)}>
          Continue
          <ChevronRight size={13} strokeWidth={1.6} className="ml-[6px]" />
        </Button>
        <Button onClick={() => onNext({})} variant="ghost">Skip for now</Button>
      </div>
    </div>
  );
}

function StepLocalModel({ onNext }: { onNext: (patches: Record<string, unknown>) => void }) {
  const { settings, patchSetting } = useSettingsStore();
  const [manifest, setManifest] = useState<ModelManifestEntry[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ModelStatus>>({});

  useEffect(() => {
    getModelManifest().then(setManifest).catch(console.error);
    checkInstalledModels().then((installed) => {
      setStatuses((prev) => {
        const next = { ...prev };
        for (const [id, path] of Object.entries(installed)) {
          if (!next[id] || next[id].kind === "idle") next[id] = { kind: "installed", path };
        }
        return next;
      });
    }).catch(console.error);
  }, []);

  useEffect(() => {
    let mounted = true;
    const unlisteners: Array<() => void> = [];
    Promise.all([
      onModelDownloadProgress(({ id, downloaded, total, validating }) => {
        setStatuses((prev) => ({ ...prev, [id]: validating ? { kind: "validating" } : { kind: "downloading", downloaded, total } }));
      }),
      onModelDownloadDone(({ id, path }) => {
        setStatuses((prev) => ({ ...prev, [id]: { kind: "installed", path } }));
        patchSetting("localModelPath", path);
      }),
      onModelDownloadError(({ id, message }) => {
        setStatuses((prev) => ({ ...prev, [id]: { kind: "error", message } }));
      }),
      onModelDownloadCancelled((id) => {
        setStatuses((prev) => ({ ...prev, [id]: { kind: "idle" } }));
      }),
    ]).then((us) => { if (!mounted) us.forEach((u) => u()); else unlisteners.push(...us); });
    return () => { mounted = false; unlisteners.forEach((u) => u()); };
  }, [patchSetting]);

  const handleDownload = async (modelId: string) => {
    try {
      const base = await appDataDir();
      const dir = await join(base, "models");
      await downloadModel(modelId, dir);
    } catch (e) { console.error(e); }
  };

  const hasInstalled = Object.values(statuses).some((s) => s.kind === "installed");

  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      <div className="flex flex-col gap-[var(--space-3)]">
        <span className="font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px] text-[var(--text-tertiary)]" style={{ lineHeight: 1 }}>Step 3 of 6 — Local</span>
        <h2 className="text-[24px] font-medium text-[var(--text-primary)]" style={{ fontFamily: "var(--font-sans)", lineHeight: 1.2, letterSpacing: "-0.01em" }}>Download a Whisper model</h2>
        <p className="text-[13px] text-[var(--text-secondary)]" style={{ maxWidth: "52ch", lineHeight: 1.6 }}>Pick a model to download. Tiny is fastest; Large is most accurate.</p>
      </div>
      <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--border-hairline)] overflow-hidden">
        {manifest.length === 0 && (
          <div className="px-[var(--space-5)] py-[var(--space-4)] text-[12px] text-[var(--text-tertiary)] font-[var(--font-mono)] flex items-center gap-[var(--space-2)]">
            <Loader2 size={12} strokeWidth={1.6} className="animate-spin" />
            Loading manifest...
          </div>
        )}
        {manifest.map((m, i) => {
          const status: ModelStatus = statuses[m.id] ?? { kind: "idle" };
          const isActive = status.kind === "installed" && settings.localModelPath === status.path;
          return (
            <div key={m.id} className={`px-[var(--space-5)] py-[var(--space-4)] flex items-center gap-[var(--space-4)] ${i < manifest.length - 1 ? "border-b border-[var(--border-hairline)]" : ""} ${isActive ? "bg-[var(--bg-sunken)]" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-[var(--space-3)]">
                  <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">{m.name}</span>
                  <span className="text-[10px] font-[var(--font-mono)] text-[var(--text-tertiary)] shrink-0">{formatBytes(m.sizeBytes)}</span>
                  {isActive && <span className="text-[10px] font-[var(--font-mono)] uppercase tracking-[0.14em]" style={{ color: "var(--accent)" }}>active</span>}
                </div>
                {status.kind === "downloading" && (
                  <div className="mt-[var(--space-2)] flex items-center gap-[var(--space-3)]">
                    <span className="relative flex-1 h-[2px] rounded-[var(--radius-full)] bg-[var(--border-hairline)] overflow-hidden">
                      <span className="absolute inset-y-0 left-0 bg-[var(--accent)] transition-[width] duration-150" style={{ width: `${(status.downloaded / status.total) * 100}%` }} />
                    </span>
                    <span className="font-[var(--font-mono)] text-[10px] text-[var(--text-tertiary)] tabular-nums shrink-0">{Math.round((status.downloaded / status.total) * 100)}%</span>
                  </div>
                )}
                {status.kind === "validating" && (
                  <p className="mt-[var(--space-2)] text-[10px] font-[var(--font-mono)] text-[var(--text-tertiary)] inline-flex items-center gap-[6px]">
                    <Loader2 size={10} strokeWidth={1.6} className="animate-spin" />Validating
                  </p>
                )}
                {status.kind === "error" && (
                  <p className="mt-[var(--space-2)] text-[10px] font-[var(--font-mono)] text-[var(--color-error)] truncate">{status.message}</p>
                )}
              </div>
              <div className="shrink-0 flex items-center gap-[var(--space-2)]">
                {(status.kind === "idle" || status.kind === "error") && (
                  <Button onClick={() => handleDownload(m.id)} size="sm" variant="default">
                    <Download size={12} strokeWidth={1.6} className="mr-[6px]" />{status.kind === "error" ? "Retry" : "Download"}
                  </Button>
                )}
                {status.kind === "downloading" && (
                  <Button onClick={() => cancelDownload(m.id)} size="sm" variant="ghost">
                    <X size={12} strokeWidth={1.6} className="mr-[6px]" />Cancel
                  </Button>
                )}
                {status.kind === "validating" && <span className="text-[10px] font-[var(--font-mono)] text-[var(--text-tertiary)]">wait</span>}
                {status.kind === "installed" && (
                  isActive ? (
                    <span className="inline-flex items-center gap-[6px] text-[11px] font-[var(--font-mono)] text-[var(--accent)] px-[var(--space-2)]">
                      <Check size={12} strokeWidth={1.8} />In use
                    </span>
                  ) : (
                    <Button onClick={() => { if (status.kind === "installed") patchSetting("localModelPath", status.path); }} size="sm" variant="ghost">Use</Button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-[var(--space-3)]">
        <Button onClick={() => onNext({})} variant="default" disabled={!hasInstalled}>
          Continue
          <ChevronRight size={13} strokeWidth={1.6} className="ml-[6px]" />
        </Button>
        <Button onClick={() => onNext({})} variant="ghost">Skip for now</Button>
      </div>
    </div>
  );
}

function StepHotkey({ onNext }: { onNext: (patches: Record<string, unknown>) => void }) {
  const { settings } = useSettingsStore();
  const [hotkey, setHotkey] = useState(settings.hotkey);
  const [hotkeyMode, setHotkeyMode] = useState(settings.hotkeyMode);

  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      <div className="flex flex-col gap-[var(--space-3)]">
        <span className="font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px] text-[var(--text-tertiary)]" style={{ lineHeight: 1 }}>Step 4 of 6</span>
        <h2 className="text-[24px] font-medium text-[var(--text-primary)]" style={{ fontFamily: "var(--font-sans)", lineHeight: 1.2, letterSpacing: "-0.01em" }}>Set your hotkey</h2>
        <p className="text-[13px] text-[var(--text-secondary)]" style={{ maxWidth: "52ch", lineHeight: 1.6 }}>This key triggers dictation from any window.</p>
      </div>
      <div className="flex flex-col gap-[var(--space-6)]">
        <div className="flex flex-col gap-[var(--space-3)]">
          <span className="text-[12px] text-[var(--text-primary)]">Trigger mode</span>
          <div className="grid grid-cols-2 gap-[var(--space-2)]">
            {([
              { id: "toggle", label: "Toggle", desc: "Press once to start, again to stop." },
              { id: "pushToTalk", label: "Push to talk", desc: "Hold while speaking, release to send." },
            ] as const).map(({ id, label, desc }) => {
              const active = hotkeyMode === id;
              return (
                <button
                  key={id}
                  onClick={() => setHotkeyMode(id)}
                  aria-pressed={active}
                  className={`text-left rounded-[var(--radius-md)] border px-[var(--space-4)] py-[var(--space-3)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-base)] ${
                    active ? "bg-[var(--bg-raised)] border-[var(--border)]" : "bg-transparent border-[var(--border-hairline)] hover:border-[var(--border)] hover:bg-[var(--bg-raised)]"
                  }`}
                >
                  <div className="flex items-center gap-[var(--space-2)] mb-[2px]">
                    <span className="block w-[6px] h-[6px] rounded-full transition-colors duration-150" style={{ background: active ? "var(--accent)" : "var(--text-ghost)" }} />
                    <span className={`text-[12px] font-medium ${active ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>{label}</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-tertiary)] leading-snug">{desc}</p>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-[var(--space-2)]">
          <label className="text-[12px] text-[var(--text-primary)]">Key combination</label>
          <HotkeyCapture value={hotkey} onChange={setHotkey} />
          <span className="text-[10px] text-[var(--text-tertiary)] font-[var(--font-mono)]">Click the chip then press your desired keys</span>
        </div>
      </div>
      <div>
        <Button onClick={() => onNext({ hotkey, hotkeyMode })} variant="default">
          Continue
          <ChevronRight size={13} strokeWidth={1.6} className="ml-[6px]" />
        </Button>
      </div>
    </div>
  );
}

type MicTestState = "idle" | "recording" | "done" | "error";

function StepMicTest({ onNext }: { onNext: () => void }) {
  const [testState, setTestState] = useState<MicTestState>("idle");
  const [countdown, setCountdown] = useState(5);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const startTest = async () => {
    setErr(null);
    setAudioSrc(null);
    setTestState("recording");
    setCountdown(5);

    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { if (countdownRef.current) clearInterval(countdownRef.current); return 0; }
        return c - 1;
      });
    }, 1000);

    try {
      const path = await recordMicTest();
      setAudioSrc(convertFileSrc(path));
      setTestState("done");
    } catch (e) {
      setErr(String(e));
      setTestState("error");
    } finally {
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
  };

  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      <div className="flex flex-col gap-[var(--space-3)]">
        <span className="font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px] text-[var(--text-tertiary)]" style={{ lineHeight: 1 }}>Step 5 of 6</span>
        <h2 className="text-[24px] font-medium text-[var(--text-primary)]" style={{ fontFamily: "var(--font-sans)", lineHeight: 1.2, letterSpacing: "-0.01em" }}>Test your microphone</h2>
        <p className="text-[13px] text-[var(--text-secondary)]" style={{ maxWidth: "52ch", lineHeight: 1.6 }}>Record 5 seconds of audio and play it back to confirm your mic is working.</p>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-sunken)] px-[var(--space-6)] py-[var(--space-6)] flex flex-col items-center gap-[var(--space-5)]">
        {testState === "idle" && (
          <button
            onClick={startTest}
            className="w-16 h-16 rounded-full border-2 border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            aria-label="Start mic test"
          >
            <Mic size={24} strokeWidth={1.4} />
          </button>
        )}

        {testState === "recording" && (
          <div className="flex flex-col items-center gap-[var(--space-4)]">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ border: "2px solid var(--accent)" }}>
              <span className="text-[28px] font-[var(--font-mono)] font-medium text-[var(--accent)]" style={{ lineHeight: 1 }}>{countdown}</span>
            </div>
            <span className="text-[12px] font-[var(--font-mono)] text-[var(--text-tertiary)]">Recording... speak now</span>
          </div>
        )}

        {testState === "done" && audioSrc && (
          <div className="flex flex-col items-center gap-[var(--space-4)] w-full">
            <div className="w-16 h-16 rounded-full border-2 flex items-center justify-center" style={{ borderColor: "var(--accent)" }}>
              <Check size={24} strokeWidth={1.6} style={{ color: "var(--accent)" }} />
            </div>
            <audio controls src={audioSrc} className="w-full max-w-[320px]" style={{ accentColor: "var(--accent)" }} />
          </div>
        )}

        {testState === "error" && (
          <div className="flex flex-col items-center gap-[var(--space-3)]">
            <span className="text-[12px] font-[var(--font-mono)] text-[var(--color-error)]">{err ?? "Recording failed"}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-[var(--space-3)]">
        {(testState === "done" || testState === "error") && (
          <Button onClick={startTest} variant="ghost" size="sm">
            <RotateCcw size={12} strokeWidth={1.6} className="mr-[6px]" />Try again
          </Button>
        )}
        <Button
          onClick={onNext}
          variant="default"
          disabled={testState === "recording"}
        >
          {testState === "idle" ? "Skip" : testState === "done" ? "Sounds good" : testState === "error" ? "Continue anyway" : "Recording..."}
          {testState !== "recording" && <ChevronRight size={13} strokeWidth={1.6} className="ml-[6px]" />}
        </Button>
      </div>
    </div>
  );
}

function StepDone({ onFinish }: { onFinish: () => void }) {
  const { settings } = useSettingsStore();
  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      <div className="flex flex-col gap-[var(--space-4)]">
        <h2
          className="text-[32px] font-medium text-[var(--text-primary)] flex items-baseline gap-[var(--space-2)]"
          style={{ fontFamily: "var(--font-sans)", lineHeight: 1.1, letterSpacing: "-0.02em" }}
        >
          You are ready
          <CursorBlock size="lg" animate="blink" />
        </h2>
        <p className="text-[13px] text-[var(--text-secondary)]" style={{ maxWidth: "52ch", lineHeight: 1.7 }}>
          Here is what you configured. You can change any of this in Settings.
        </p>
      </div>
      <div className="flex flex-col gap-[2px] rounded-[var(--radius-lg)] border border-[var(--border-hairline)] overflow-hidden">
        {[
          { label: "Mode", value: settings.transcriptionMode === "cloud" ? "Cloud (Groq)" : "Local (Whisper)" },
          { label: "Hotkey", value: settings.hotkey, mono: true },
          { label: "Trigger", value: settings.hotkeyMode === "toggle" ? "Toggle" : "Push to talk" },
          { label: "API key", value: settings.transcriptionMode === "cloud" ? (settings.groqApiKeyConfigured ? "Set" : "Not set") : "N/A" },
        ].map(({ label, value, mono }, i, arr) => (
          <div key={label} className={`flex items-center justify-between px-[var(--space-5)] py-[var(--space-3)] ${i < arr.length - 1 ? "border-b border-[var(--border-hairline)]" : ""}`}>
            <span className="text-[12px] text-[var(--text-secondary)]">{label}</span>
            <span className={`text-[12px] text-[var(--text-primary)] ${mono ? "font-[var(--font-mono)]" : ""}`}>{value}</span>
          </div>
        ))}
      </div>
      <div>
        <Button onClick={onFinish} variant="solid">
          Start using Ello
          <ChevronRight size={13} strokeWidth={1.6} className="ml-[6px]" />
        </Button>
      </div>
    </div>
  );
}
