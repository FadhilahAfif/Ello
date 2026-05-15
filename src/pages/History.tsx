import { Section } from "../components/Section";
import { CursorBlock } from "../components/ui/CursorBlock";
import { ArrowUpRight } from "lucide-react";

export function History() {
  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        <span
          className="font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px] text-[var(--text-tertiary)]"
          style={{ lineHeight: 1 }}
        >
          Transcripts
        </span>
        <h1
          className="text-[24px] font-medium text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-sans)", lineHeight: 1.2, letterSpacing: "-0.01em" }}
        >
          History
        </h1>
      </div>

      <Section flush>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-[var(--space-6)] py-[var(--space-10)] flex flex-col items-start gap-[var(--space-4)]">
          <span
            className="font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Phase 9
          </span>
          <p
            className="font-[var(--font-mono)] text-[13px] text-[var(--text-secondary)] flex items-center"
            style={{ maxWidth: "60ch", lineHeight: 1.7 }}
          >
            Searchable transcript history lives here once Phase 9 lands
            <CursorBlock size="sm" animate="pulse" />
          </p>
          <p className="text-[11px] text-[var(--text-tertiary)]" style={{ maxWidth: "60ch" }}>
            Full-text search across every transcript, copy and export per row,
            and a single switch to wipe local history. Until then, your last
            transcript is shown on the dashboard.
          </p>
          <button
            onClick={() => (window.location.hash = "/dashboard")}
            className="group inline-flex items-center gap-[6px] text-[12px] text-[var(--accent)] hover:text-[var(--text-primary)] transition-colors duration-150"
          >
            Go to dashboard
            <ArrowUpRight
              size={12}
              strokeWidth={1.6}
              className="transition-transform duration-150 group-hover:translate-x-[1px] group-hover:-translate-y-[1px]"
            />
          </button>
        </div>
      </Section>
    </div>
  );
}
