import { Section } from "../components/Section";
import { CursorBlock } from "../components/ui/CursorBlock";
import { ArrowUpRight } from "lucide-react";

export function Vocabulary() {
  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        <span
          className="font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px] text-[var(--text-tertiary)]"
          style={{ lineHeight: 1 }}
        >
          Replacements
        </span>
        <h1
          className="text-[24px] font-medium text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-sans)", lineHeight: 1.2, letterSpacing: "-0.01em" }}
        >
          Vocabulary
        </h1>
      </div>

      <Section flush>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-[var(--space-6)] py-[var(--space-10)] flex flex-col items-start gap-[var(--space-4)]">
          <span
            className="font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Phase 8
          </span>
          <p
            className="font-[var(--font-mono)] text-[13px] text-[var(--text-secondary)] flex items-center"
            style={{ maxWidth: "60ch", lineHeight: 1.7 }}
          >
            Custom replacement rules will live here
            <CursorBlock size="sm" animate="pulse" />
          </p>
          <p className="text-[11px] text-[var(--text-tertiary)]" style={{ maxWidth: "60ch" }}>
            Teach Ello how to spell your team's names, product terms, and
            jargon. Whisper alone often gets these wrong; a small ruleset is the
            shortest path to clean output.
          </p>
          <button
            onClick={() => (window.location.hash = "/settings")}
            className="group inline-flex items-center gap-[6px] text-[12px] text-[var(--accent)] hover:text-[var(--text-primary)] transition-colors duration-150"
          >
            Open settings
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
