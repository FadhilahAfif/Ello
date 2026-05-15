import { useSettingsStore } from "../store/settings";
import { StatusHero } from "../components/StatusHero";
import { CursorBlock } from "../components/ui/CursorBlock";
import { HotkeyChips } from "../components/HotkeyChips";
import { navigate } from "../app/router";
import { ArrowUpRight, Mic, Cloud, Cpu, Keyboard } from "lucide-react";

export function Dashboard() {
  const status = useSettingsStore((s) => s.status);
  const lastTranscript = useSettingsStore((s) => s.lastTranscript);
  const settings = useSettingsStore((s) => s.settings);
  const devices = useSettingsStore((s) => s.devices);
  const error = useSettingsStore((s) => s.error);

  const isRecording = status === "recording";
  const activeDevice = devices.find((d) => d.id === settings.micDeviceId) ?? devices.find((d) => d.isDefault);
  const deviceName = activeDevice?.name ?? "system default";
  const modelName = settings.transcriptionMode === "cloud" ? settings.cloudModel : "local whisper";
  const wordCount = lastTranscript ? lastTranscript.split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-3)] bg-[var(--bg-raised)] border border-[var(--color-error-border)] rounded-[var(--radius-md)]"
        >
          <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.14em] mt-[2px] text-[var(--color-error)]">
            Err
          </span>
          <span className="font-[var(--font-mono)] text-[12px] text-[var(--color-error)]">{error}</span>
        </div>
      )}

      <StatusHero />

      {/* Ready strip: live config, not placeholder stats. Inline rail. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-[var(--space-6)] gap-y-[var(--space-4)] px-[var(--space-1)]">
        <ConfigItem
          icon={settings.transcriptionMode === "cloud" ? Cloud : Cpu}
          label="Mode"
          value={settings.transcriptionMode}
          sub={modelName}
          onClick={() => navigate("/settings")}
        />
        <ConfigItem
          icon={Keyboard}
          label="Hotkey"
          rich={<HotkeyChips value={settings.hotkey} size="md" tone="muted" />}
          sub={settings.hotkeyMode === "toggle" ? "toggle" : "push to talk"}
          onClick={() => { window.location.hash = "/settings#hotkey"; }}
        />
        <ConfigItem
          icon={Mic}
          label="Microphone"
          value={deviceName}
          sub={activeDevice?.isDefault ? "system default" : "custom device"}
          onClick={() => { window.location.hash = "/settings#audio"; }}
          truncate
        />
        <ConfigItem
          label="Last output"
          value={lastTranscript ? `${wordCount} words` : "none yet"}
          sub={lastTranscript ? "fresh" : "press the hotkey"}
        />
      </div>

      {/* Output transcript */}
      <div className="flex flex-col gap-[var(--space-3)]">
        <div className="flex items-baseline justify-between">
          <span
            className="font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px] text-[var(--text-tertiary)]"
            style={{ lineHeight: 1 }}
          >
            Output
          </span>
          {lastTranscript && (
            <button
              onClick={() => navigator.clipboard.writeText(lastTranscript)}
              className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors duration-150"
            >
              Copy
            </button>
          )}
        </div>
        <div
          aria-live="polite"
          aria-atomic="true"
          className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-sunken)] px-[var(--space-5)] py-[var(--space-5)] min-h-[140px] flex"
        >
          {lastTranscript ? (
            <p
              className="font-[var(--font-mono)] text-[13px] text-[var(--text-primary)]"
              style={{ lineHeight: 1.7, maxWidth: "70ch" }}
            >
              {lastTranscript}
              {isRecording && <CursorBlock size="sm" animate="blink" />}
            </p>
          ) : (
            <p
              className="font-[var(--font-mono)] text-[12px] text-[var(--text-tertiary)] flex items-center"
              style={{ lineHeight: 1.7 }}
            >
              {isRecording ? (
                <>
                  Listening
                  <CursorBlock size="sm" animate="blink" />
                </>
              ) : (
                <>
                  Press your hotkey to start
                  <CursorBlock size="sm" animate="pulse" />
                </>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Quick links footer */}
      <div className="flex flex-wrap items-center gap-[var(--space-5)] pt-[var(--space-4)] border-t border-[var(--border-hairline)]">
        <QuickLink label="Settings" onClick={() => navigate("/settings")} />
        <QuickLink label="Models" onClick={() => navigate("/models")} />
        <QuickLink label="History" onClick={() => navigate("/history")} />
        <span className="ml-auto font-[var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[var(--text-ghost)]">
          v0.1.0
        </span>
      </div>
    </div>
  );
}

function ConfigItem({
  icon: Icon,
  label,
  value,
  rich,
  sub,
  onClick,
  truncate = false,
}: {
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  value?: string;
  rich?: React.ReactNode;
  sub?: string;
  onClick?: () => void;
  truncate?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`group flex flex-col items-start gap-[var(--space-2)] text-left ${
        onClick
          ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)] rounded-[var(--radius-sm)]"
          : ""
      }`}
    >
      <span
        className="inline-flex items-center gap-[6px] font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px] text-[var(--text-tertiary)]"
        style={{ lineHeight: 1 }}
      >
        {Icon && <Icon size={11} strokeWidth={1.6} className="opacity-70" />}
        {label}
      </span>
      {rich ? (
        rich
      ) : (
        <span
          className={`text-[14px] text-[var(--text-primary)] ${truncate ? "max-w-full truncate" : ""}`}
          style={{ lineHeight: 1.2 }}
          title={truncate ? value : undefined}
        >
          {value}
        </span>
      )}
      {sub && (
        <span
          className="font-[var(--font-mono)] text-[10px] text-[var(--text-tertiary)] truncate max-w-full"
          style={{ lineHeight: 1 }}
          title={sub}
        >
          {sub}
        </span>
      )}
    </Tag>
  );
}

function QuickLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group inline-flex items-center gap-[6px] text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors duration-150 focus-visible:outline-none focus-visible:text-[var(--text-primary)]"
    >
      <span>{label}</span>
      <ArrowUpRight
        size={12}
        strokeWidth={1.6}
        className="transition-transform duration-150 group-hover:translate-x-[1px] group-hover:-translate-y-[1px]"
      />
    </button>
  );
}
