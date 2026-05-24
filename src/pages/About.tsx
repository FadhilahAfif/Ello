import { useState, useEffect } from "react";
import { Wordmark } from "../components/ui/Wordmark";
import { Section } from "../components/Section";
import { Button } from "../components/ui/Button";
import { ExternalLink, RefreshCw, Loader2 } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { check } from "@tauri-apps/plugin-updater";
import { toast } from "../components/ui/Toast";

export function About() {
  const [version, setVersion] = useState<string>("…");
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion("unknown"));
  }, []);

  const handleCheckUpdates = async () => {
    setChecking(true);
    try {
      const update = await check();
      setLastChecked(new Date());
      if (update?.available) {
        toast(`Update available: v${update.version}`, "info");
      } else {
        toast("You're on the latest version.", "info");
      }
    } catch {
      toast("Update check failed. Check your connection.", "error");
    } finally {
      setChecking(false);
    }
  };

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
          <Row label="Version" value={version} />
          <Row label="Channel" value="stable" />
          <Row label="License" value="MIT" />
        </div>
      </Section>

      <Section eyebrow="Updates" title="Auto-update" flush>
        <div className="flex flex-col gap-[var(--space-4)]">
          <div className="flex items-center gap-[var(--space-3)]">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCheckUpdates}
              disabled={checking}
            >
              {checking ? (
                <span className="inline-flex items-center gap-[6px]">
                  <Loader2 size={12} strokeWidth={1.6} className="animate-spin" />
                  Checking
                </span>
              ) : (
                <span className="inline-flex items-center gap-[6px]">
                  <RefreshCw size={12} strokeWidth={1.6} />
                  Check for updates
                </span>
              )}
            </Button>
            {lastChecked && (
              <span className="text-[11px] text-[var(--text-tertiary)] font-[var(--font-mono)]">
                checked {lastChecked.toLocaleTimeString()}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--text-tertiary)] font-[var(--font-mono)]">
            Release notes: github.com/YOUR_ORG/ello/releases
          </p>
        </div>
      </Section>

      <Section eyebrow="Links" title="Project" flush>
        <div className="flex flex-col">
          <LinkRow href="https://github.com/FadhilahAfif/Ello" label="Source" />
          <LinkRow href="https://github.com/FadhilahAfif/Ello/issues" label="Issues" />
          <LinkRow href="https://github.com/FadhilahAfif/Ello/releases" label="Releases" />
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
