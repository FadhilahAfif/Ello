import { useState, useEffect } from "react";
import { BarChart2 } from "lucide-react";
import { Section } from "../components/Section";
import { statsSummary, type StatsSummary } from "../lib/invoke";
import { toast } from "../components/ui/Toast";

type Range = 7 | 30 | 90;

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function estimateTimeSaved(words: number): string {
  const avgTypingWpm = 40;
  const ms = (words / avgTypingWpm) * 60_000;
  return formatDuration(ms);
}

interface DailyBar {
  label: string;
  value: number;
}

function buildPlaceholderBars(range: Range): DailyBar[] {
  const bars: DailyBar[] = [];
  const now = new Date();
  const count = range === 7 ? 7 : range === 30 ? 10 : 13;
  const step = range === 7 ? 1 : range === 30 ? 3 : 7;
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * step);
    const label =
      range === 7
        ? d.toLocaleDateString(undefined, { weekday: "short" })
        : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    bars.push({ label, value: 0 });
  }
  return bars;
}

function SvgBarChart({ bars, maxValue }: { bars: DailyBar[]; maxValue: number }) {
  const W = 480;
  const H = 120;
  const PAD_LEFT = 0;
  const PAD_BOTTOM = 20;
  const chartH = H - PAD_BOTTOM;
  const barCount = bars.length;
  const gap = 4;
  const barW = Math.max(4, (W - PAD_LEFT - gap * (barCount - 1)) / barCount - gap * 0.5);
  const step = (W - PAD_LEFT) / barCount;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      aria-label="Bar chart of word counts"
      role="img"
      className="w-full"
      style={{ height: H, overflow: "visible" }}
    >
      {bars.map((bar, i) => {
        const x = PAD_LEFT + i * step + (step - barW) / 2;
        const fillH = maxValue > 0 ? (bar.value / maxValue) * chartH : 0;
        const y = chartH - fillH;
        return (
          <g key={i}>
            <rect
              x={x}
              y={0}
              width={barW}
              height={chartH}
              fill="var(--bg-raised)"
              rx={3}
            />
            {fillH > 0 && (
              <rect
                x={x}
                y={y}
                width={barW}
                height={fillH}
                fill="var(--accent)"
                rx={3}
                opacity={0.85}
              />
            )}
            <text
              x={x + barW / 2}
              y={H - 4}
              textAnchor="middle"
              fontSize={9}
              fill="var(--text-ghost)"
              fontFamily="var(--font-mono)"
            >
              {bar.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function Stats() {
  const [range, setRange] = useState<Range>(7);
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    statsSummary(range)
      .then(setSummary)
      .catch((e) => toast(`Failed to load stats: ${String(e)}`, "error"))
      .finally(() => setLoading(false));
  }, [range]);

  const bars = buildPlaceholderBars(range);
  const maxValue = summary ? Math.max(summary.words, 1) : 1;

  const statCards = summary
    ? [
        { label: "Sessions", value: summary.sessions.toLocaleString() },
        { label: "Words", value: summary.words.toLocaleString() },
        { label: "Avg WPM", value: summary.avgWpm > 0 ? summary.avgWpm.toFixed(0) : "—" },
        { label: "Time saved", value: summary.words > 0 ? estimateTimeSaved(summary.words) : "—" },
        { label: "Recording time", value: summary.totalDurationMs > 0 ? formatDuration(summary.totalDurationMs) : "—" },
      ]
    : [];

  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      <div className="flex items-end justify-between gap-[var(--space-4)]">
        <div className="flex flex-col gap-[var(--space-1)]">
          <span
            className="font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px] text-[var(--text-tertiary)]"
            style={{ lineHeight: 1 }}
          >
            Usage
          </span>
          <h1
            className="text-[24px] font-medium text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-sans)", lineHeight: 1.2, letterSpacing: "-0.01em" }}
          >
            Stats
          </h1>
        </div>

        <div
          role="group"
          aria-label="Time range"
          className="flex items-center gap-[2px] bg-[var(--bg-raised)] rounded-[var(--radius-md)] p-[2px]"
        >
          {([7, 30, 90] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={`font-[var(--font-mono)] text-[11px] uppercase tracking-[0.12em] px-[var(--space-3)] py-[var(--space-1)] rounded-[var(--radius-sm)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                range === r
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <Section flush>
        {loading ? (
          <div className="flex items-center justify-center py-[var(--space-10)]">
            <span className="font-[var(--font-mono)] text-[11px] text-[var(--text-tertiary)] uppercase tracking-[0.14em]">
              Loading…
            </span>
          </div>
        ) : summary && summary.sessions === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-[var(--space-8)]">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-[var(--space-4)]">
              {statCards.map((card) => (
                <StatCard key={card.label} label={card.label} value={card.value} />
              ))}
            </div>

            <div className="flex flex-col gap-[var(--space-3)]">
              <span
                className="font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px] text-[var(--text-tertiary)]"
                style={{ lineHeight: 1 }}
              >
                Words · last {range} days
              </span>
              <div className="rounded-[var(--radius-lg)] border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-[var(--space-5)] py-[var(--space-5)]">
                <SvgBarChart bars={bars} maxValue={maxValue} />
              </div>
              <p className="font-[var(--font-mono)] text-[10px] text-[var(--text-ghost)]" style={{ lineHeight: 1.6 }}>
                Per-day breakdown requires daily rollup data. Chart shows the {range}-day window shape.
              </p>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-[var(--space-2)] rounded-[var(--radius-lg)] border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-[var(--space-4)] py-[var(--space-4)]">
      <span
        className="font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px] text-[var(--text-tertiary)]"
        style={{ lineHeight: 1 }}
      >
        {label}
      </span>
      <span
        className="text-[22px] font-medium text-[var(--text-primary)] tabular-nums"
        style={{ fontFamily: "var(--font-sans)", lineHeight: 1.1, letterSpacing: "-0.02em" }}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-[var(--space-6)] py-[var(--space-10)] flex flex-col items-start gap-[var(--space-4)]">
      <BarChart2 size={20} strokeWidth={1.4} className="text-[var(--text-ghost)]" aria-hidden="true" />
      <div className="flex flex-col gap-[var(--space-2)]">
        <p className="text-[14px] font-medium text-[var(--text-primary)]" style={{ fontFamily: "var(--font-sans)" }}>
          No data yet
        </p>
        <p className="font-[var(--font-mono)] text-[12px] text-[var(--text-secondary)]" style={{ maxWidth: "52ch", lineHeight: 1.7 }}>
          Stats are recorded after each transcription session. Make sure "Track usage stats" is enabled in Settings.
        </p>
      </div>
    </div>
  );
}
