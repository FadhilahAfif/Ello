interface ProgressProps {
  value: number;
  max?: number;
  label?: string;
}

export function Progress({ value, max = 100, label }: ProgressProps) {
  const pct = Math.round((value / max) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="w-full h-1.5 bg-[var(--bg-raised)] rounded-[var(--radius-full)] overflow-hidden border border-[var(--border)]"
    >
      <div
        className="h-full bg-[var(--accent)] transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
