import { useSettingsStore } from "../store/settings";
import { CursorBlock } from "./ui/CursorBlock";
import { HotkeyChips } from "./HotkeyChips";
import { MicMeter } from "./MicMeter";

export function StatusHero() {
  const status = useSettingsStore((s) => s.status);
  const settings = useSettingsStore((s) => s.settings);

  const isRecording = status === "recording";
  const isTranscribing = status === "transcribing";
  const isIdle = status === "idle";

  const headline =
    isRecording ? "Listening" : isTranscribing ? "Transcribing" : "Idle";
  const trailing = isRecording ? null : ".";

  return (
    <div
      className="relative overflow-hidden rounded-[var(--radius-lg)] border transition-colors duration-300"
      style={{
        background: "var(--bg-sunken)",
        borderColor: isRecording ? "var(--accent)" : "var(--border-subtle)",
      }}
    >
      {/* Top eyebrow row */}
      <div className="flex items-center justify-between px-[var(--space-6)] pt-[var(--space-5)]">
        <span
          className="font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px]"
          style={{ color: "var(--text-tertiary)", lineHeight: 1 }}
        >
          Status
        </span>
        <div className="flex items-center gap-[var(--space-2)]">
          <span
            className="inline-block w-[6px] h-[6px] rounded-full transition-colors duration-200"
            style={{ background: isIdle ? "var(--text-ghost)" : "var(--accent)" }}
          />
          <span
            className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.14em]"
            style={{
              color: isIdle ? "var(--text-tertiary)" : "var(--accent)",
              lineHeight: 1,
            }}
          >
            {settings.transcriptionMode}
          </span>
        </div>
      </div>

      {/* Headline */}
      <div className="px-[var(--space-6)] pt-[var(--space-6)] pb-[var(--space-3)]">
        <h1
          className="flex items-baseline"
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
            fontSize: 56,
            lineHeight: 1,
            letterSpacing: "-0.025em",
            color: "var(--text-primary)",
          }}
        >
          {headline}
          {trailing}
          <CursorBlock
            size="xl"
            animate={isIdle ? "pulse" : isRecording ? "blink" : "none"}
          />
        </h1>
      </div>

      {/* Subline */}
      <div className="px-[var(--space-6)] pb-[var(--space-6)] min-h-[28px] flex items-center">
        {isIdle && (
          <p className="flex items-center gap-[var(--space-2)] flex-wrap text-[13px] text-[var(--text-secondary)]">
            <span>Press</span>
            <HotkeyChips value={settings.hotkey} size="md" tone="active" />
            <span>to dictate.</span>
          </p>
        )}
        {isRecording && (
          <p className="flex items-center gap-[var(--space-2)] flex-wrap text-[13px] text-[var(--text-secondary)]">
            <span>Recording. Press</span>
            <HotkeyChips value={settings.hotkey} size="md" tone="active" />
            <span>again to stop.</span>
          </p>
        )}
        {isTranscribing && (
          <div className="flex items-center gap-[var(--space-3)] w-full">
            <p className="text-[13px] text-[var(--text-secondary)] shrink-0">
              Sending audio to {settings.transcriptionMode === "cloud" ? "Groq" : "local Whisper"}.
            </p>
            <span className="relative flex-1 h-[1px] overflow-hidden rounded-[var(--radius-full)] bg-[var(--border-hairline)]">
              <span
                className="absolute inset-y-0 w-[20%] bg-[var(--accent)]"
                style={{ animation: "hairline-progress 1.4s var(--ease-out-quart) infinite" }}
              />
            </span>
          </div>
        )}
      </div>

      {/* Mic meter rail */}
      <div
        className="border-t transition-colors duration-200"
        style={{
          borderColor: isRecording ? "var(--border-subtle)" : "transparent",
        }}
      >
        <div
          className="px-[var(--space-6)] transition-[max-height,opacity,padding] duration-300"
          style={{
            maxHeight: isRecording ? 80 : 0,
            opacity: isRecording ? 1 : 0,
            paddingTop: isRecording ? "var(--space-4)" : 0,
            paddingBottom: isRecording ? "var(--space-4)" : 0,
            overflow: "hidden",
          }}
        >
          <MicMeter active={isRecording} height={40} bars={40} />
        </div>
      </div>
    </div>
  );
}
