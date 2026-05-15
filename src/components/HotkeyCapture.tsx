import { useState, useCallback } from "react";

interface HotkeyCaptureProps {
  value: string;
  onChange: (combo: string) => void;
}

export function HotkeyCapture({ value, onChange }: HotkeyCaptureProps) {
  const [capturing, setCapturing] = useState(false);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (!capturing) return;
      e.preventDefault();

      const modifiers: string[] = [];
      if (e.ctrlKey) modifiers.push("Ctrl");
      if (e.altKey) modifiers.push("Alt");
      if (e.shiftKey) modifiers.push("Shift");
      if (e.metaKey) modifiers.push("Super");

      if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;

      if (e.key === "Escape") {
        setCapturing(false);
        return;
      }

      const keyMap: Record<string, string> = {
        " ": "Space",
        ArrowUp: "Up",
        ArrowDown: "Down",
        ArrowLeft: "Left",
        ArrowRight: "Right",
        Escape: "Escape",
        Enter: "Return",
        Backspace: "Backspace",
        Delete: "Delete",
        Tab: "Tab",
      };
      const key = keyMap[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key);
      onChange([...modifiers, key].join("+"));
      setCapturing(false);
    },
    [capturing, onChange]
  );

  return (
    <div className="flex items-center gap-[var(--space-2)]">
      <button
        className={`font-mono text-[11px] bg-[var(--bg-raised)] border rounded-[var(--radius-md)] px-[var(--space-2)] py-[var(--space-1)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-base)] ${
          capturing
            ? "border-[var(--accent)] text-[var(--accent)]"
            : "border-[var(--border)] text-[var(--text-tertiary)] hover:border-[var(--text-tertiary)]"
        }`}
        onClick={() => setCapturing(true)}
        onKeyDown={handleKeyDown}
        onBlur={() => setCapturing(false)}
        aria-label={capturing ? "Press key combination" : `Current hotkey: ${value}. Click to rebind.`}
        title="Click then press your desired key combination"
      >
        {capturing ? "Press keys…" : value}
      </button>
      {capturing && (
        <span className="text-[11px] text-[var(--text-tertiary)]">
          Press any key combo, Esc to cancel
        </span>
      )}
    </div>
  );
}
