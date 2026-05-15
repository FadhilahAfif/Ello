import { Wordmark } from "../components/ui/Wordmark";
import { CursorBlock } from "../components/ui/CursorBlock";
import { Button } from "../components/ui/Button";
import { navigate } from "../app/router";

export function Onboarding() {
  return (
    <div className="flex flex-col gap-[var(--space-10)] py-[var(--space-6)]">
      <Wordmark size="lg" />

      <div className="flex flex-col gap-[var(--space-4)]">
        <h1
          className="text-[32px] font-medium text-[var(--text-primary)] flex items-baseline"
          style={{ fontFamily: "var(--font-sans)", lineHeight: 1.1, letterSpacing: "-0.02em" }}
        >
          Welcome
          <CursorBlock size="lg" animate="pulse" />
        </h1>
        <p
          className="text-[13px] text-[var(--text-secondary)]"
          style={{ maxWidth: "56ch", lineHeight: 1.7 }}
        >
          Ello turns your voice into a cursor. Press a hotkey, speak, and what
          you said gets typed into the active window. Pick cloud (Groq) for
          speed, or local (Whisper) for privacy.
        </p>
      </div>

      <div className="flex flex-col gap-[var(--space-3)]">
        <span
          className="font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px] text-[var(--text-tertiary)]"
          style={{ lineHeight: 1 }}
        >
          Phase 10
        </span>
        <p className="text-[12px] text-[var(--text-tertiary)] font-[var(--font-mono)]" style={{ maxWidth: "56ch", lineHeight: 1.7 }}>
          A guided first-run wizard ships in Phase 10. For now, head to settings
          to pick your mode and hotkey.
        </p>
      </div>

      <div className="flex items-center gap-[var(--space-3)] pt-[var(--space-4)] border-t border-[var(--border-hairline)]">
        <Button onClick={() => navigate("/settings")} variant="default">
          Open settings
        </Button>
        <Button onClick={() => navigate("/dashboard")} variant="ghost">
          Skip
        </Button>
      </div>
    </div>
  );
}
