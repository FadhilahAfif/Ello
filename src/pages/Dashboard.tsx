import { useSettingsStore } from "../store/settings";
import { Card } from "../components/ui/Card";
import { navigate } from "../app/router";

export function Dashboard() {
  const status = useSettingsStore((s) => s.status);
  const lastTranscript = useSettingsStore((s) => s.lastTranscript);
  const error = useSettingsStore((s) => s.error);

  const statusLabel =
    status === "recording" ? "Recording…" :
    status === "transcribing" ? "Transcribing…" :
    "Idle";

  return (
    <div className="p-[var(--space-6)] flex flex-col gap-[var(--space-4)] max-w-xl">
      {error && (
        <div role="alert" className="flex items-start gap-[var(--space-2)] px-[var(--space-3)] py-[var(--space-2)] bg-[var(--bg-raised)] border border-[var(--color-error-border)] rounded-[var(--radius-lg)] text-[13px] text-[var(--color-error)]">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-[var(--space-2)]">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: status === "idle" ? "var(--text-ghost)" : "var(--accent)" }}
        />
        <span
          className="font-mono text-[11px]"
          style={{ color: status === "idle" ? "var(--text-tertiary)" : "var(--accent)" }}
        >
          {statusLabel}
        </span>
      </div>

      <Card>
        <p className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-[0.14em] mb-[var(--space-2)]">Last transcript</p>
        <p
          aria-live="polite"
          aria-atomic="true"
          className="font-mono text-[11px] text-[var(--text-secondary)] min-h-[2rem]"
        >
          {lastTranscript ?? <span className="text-[var(--text-ghost)]">Nothing yet — press your hotkey to start.</span>}
        </p>
      </Card>

      <Card>
        <p className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-[0.14em] mb-[var(--space-2)]">Today</p>
        <p className="font-mono text-[16px] font-medium text-[var(--text-primary)]">0</p>
        <p className="text-[10px] text-[var(--text-ghost)]">words</p>
      </Card>

      <div className="flex gap-[var(--space-2)]">
        <button
          onClick={() => navigate("/settings")}
          className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          Settings →
        </button>
        <button
          onClick={() => navigate("/models")}
          className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          Models →
        </button>
      </div>
    </div>
  );
}
