import { Wordmark } from "../components/ui/Wordmark";
import { Section } from "../components/Section";
import { ExternalLink } from "lucide-react";

const APP_VERSION = "0.1.0";

export function About() {
  return (
    <div className="flex flex-col gap-[var(--space-10)]">
      <div className="flex flex-col gap-[var(--space-4)]">
        <Wordmark size="lg" />
        <p
          className="text-[13px] text-[var(--text-secondary)]"
          style={{ maxWidth: "52ch", lineHeight: 1.6 }}
        >
          A tiny Windows dictation app. Press a hotkey, speak, and the
          transcript types itself into whatever window is focused. Run
          transcription on Groq for speed or locally with Whisper for privacy.
        </p>
      </div>

      <Section eyebrow="Build" title="Version" flush>
        <div className="flex flex-col gap-[var(--space-3)] font-[var(--font-mono)] text-[12px]">
          <Row label="Version" value={APP_VERSION} />
          <Row label="Channel" value="stable" />
          <Row label="License" value="MIT" />
        </div>
      </Section>

      <Section eyebrow="Links" title="Project" flush>
        <div className="flex flex-col">
          <LinkRow href="https://github.com/aficraft/ello" label="Source" />
          <LinkRow href="https://github.com/aficraft/ello/issues" label="Issues" />
          <LinkRow href="https://github.com/aficraft/ello/releases" label="Releases" />
        </div>
      </Section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-[var(--border-hairline)] py-[var(--space-2)]">
      <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{label}</span>
      <span className="text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center justify-between py-[var(--space-3)] border-b border-[var(--border-hairline)] last:border-b-0 transition-colors duration-150 hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:text-[var(--text-primary)]"
    >
      <span className="text-[12px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
        {label}
      </span>
      <ExternalLink
        size={12}
        strokeWidth={1.6}
        className="text-[var(--text-tertiary)] group-hover:text-[var(--accent)] transition-colors duration-150"
      />
    </a>
  );
}
