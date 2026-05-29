import { useState, useEffect, useCallback } from "react";
import { ArrowUpRight, Mic, Cloud, Cpu, Keyboard, Copy } from "lucide-react";
import { useSettingsStore } from "../store/settings";
import { StatusHero } from "../components/StatusHero";
import { CursorBlock } from "../components/ui/CursorBlock";
import { HotkeyChips } from "../components/HotkeyChips";
import { navigate } from "../app/router";
import { historyList, statsSummary, type HistoryItem, type StatsSummary } from "../lib/invoke";
import { toast } from "../components/ui/Toast";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function Dashboard() {
  const status = useSettingsStore((s) => s.status);
  const lastTranscript = useSettingsStore((s) => s.lastTranscript);
  const settings = useSettingsStore((s) => s.settings);
  const devices = useSettingsStore((s) => s.devices);
  const error = useSettingsStore((s) => s.error);

  const [recentItems, setRecentItems] = useState<HistoryItem[]>([]);
  const [weekStats, setWeekStats] = useState<StatsSummary | null>(null);

  const isRecording = status === "recording";
  const activeDevice = devices.find((d) => d.id === settings.micDeviceId) ?? devices.find((d) => d.isDefault);
  const deviceName = activeDevice?.name ?? "system default";
  const modelName = settings.transcriptionMode === "cloud" ? settings.cloudModel : "local whisper";

  const loadData = useCallback(async () => {
    try {
      const [items, stats] = await Promise.all([
        historyList(null, 5, 0),
        statsSummary(7),
      ]);
      setRecentItems(items);
      setWeekStats(stats);
    } catch {
      // non-critical — dashboard still works without history/stats
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (status === "idle" && lastTranscript) {
      loadData();
    }
  }, [status, lastTranscript, loadData]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast("Copied to clipboard");
    }).catch(() => {
      toast("Copy failed", "error");
    });
  };

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

      {/* Config strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-[var(--space-6)] gap-y-[var(--space-4)] px-[var(--space-1)]">
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
        {weekStats ? (
          <ConfigItem
            label="Last 7 days"
            value={`${weekStats.words.toLocaleString()} words`}
            sub={`${weekStats.sessions} session${weekStats.sessions !== 1 ? "s" : ""}`}
            onClick={() => navigate("/stats")}
          />
        ) : (
          <ConfigItem
            label="Last output"
            value={lastTranscript ? `${lastTranscript.split(/\s+/).filter(Boolean).length} words` : "none yet"}
            sub={lastTranscript ? "fresh" : "press the hotkey"}
          />
        )}
      </div>

      {/* Last transcript output */}
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
              onClick={() => handleCopy(lastTranscript)}
              className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              Copy
            </button>
          )}
        </div>
        <div
          aria-live="polite"
          aria-atomic="true"
          className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-sunken)] px-[var(--space-5)] py-[var(--space-5)] min-h-[120px] flex"
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
                <>Listening<CursorBlock size="sm" animate="blink" /></>
              ) : (
                <>Press your hotkey to start<CursorBlock size="sm" animate="pulse" /></>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Recent transcripts */}
      {recentItems.length > 0 && (
        <div className="flex flex-col gap-[var(--space-3)]">
          <div className="flex items-baseline justify-between">
            <span
              className="font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px] text-[var(--text-tertiary)]"
              style={{ lineHeight: 1 }}
            >
              Recent
            </span>
            <button
              onClick={() => navigate("/history")}
              className="group inline-flex items-center gap-[4px] font-[var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              View all
              <ArrowUpRight size={10} strokeWidth={1.6} className="transition-transform duration-150 group-hover:translate-x-[1px] group-hover:-translate-y-[1px]" aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--border-hairline)] overflow-hidden">
            {recentItems.map((item, i) => (
              <RecentRow
                key={item.id}
                item={item}
                onCopy={() => handleCopy(item.text)}
                isLast={i === recentItems.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="flex flex-wrap items-center gap-[var(--space-5)] pt-[var(--space-4)] border-t border-[var(--border-hairline)]">
        <QuickLink label="Settings" onClick={() => navigate("/settings")} />
        <QuickLink label="Models" onClick={() => navigate("/models")} />
        <QuickLink label="History" onClick={() => navigate("/history")} />
        <QuickLink label="Stats" onClick={() => navigate("/stats")} />
        <span className="ml-auto font-[var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[var(--text-ghost)]">
          v0.1.0
        </span>
      </div>
    </div>
  );
}

function RecentRow({
  item,
  onCopy,
  isLast,
}: {
  item: HistoryItem;
  onCopy: () => void;
  isLast: boolean;
}) {
  return (
    <div
      className={`group flex items-start gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-3)] bg-[var(--bg-surface)] hover:bg-[var(--bg-raised)] transition-colors duration-100 ${
        !isLast ? "border-b border-[var(--border-hairline)]" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <p
          className="font-[var(--font-mono)] text-[12px] text-[var(--text-primary)] truncate"
          style={{ lineHeight: 1.5 }}
        >
          {item.text}
        </p>
        <span className="font-[var(--font-mono)] text-[10px] text-[var(--text-ghost)]">
          {formatDate(item.createdAt)} · {item.wordCount}w
        </span>
      </div>
      <button
        onClick={onCopy}
        aria-label="Copy transcript"
        title="Copy"
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] opacity-0 group-hover:opacity-100 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:opacity-100"
      >
        <Copy size={12} strokeWidth={1.6} aria-hidden="true" />
      </button>
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
      {rich ? rich : (
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
      className="group inline-flex items-center gap-[6px] text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-base)] rounded-[var(--radius-sm)]"
    >
      <span>{label}</span>
      <ArrowUpRight size={12} strokeWidth={1.6} className="transition-transform duration-150 group-hover:translate-x-[1px] group-hover:-translate-y-[1px]" aria-hidden="true" />
    </button>
  );
}
