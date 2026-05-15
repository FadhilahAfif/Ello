interface HotkeyChipsProps {
  /** Hotkey combo, e.g. "Ctrl+Alt+Space" */
  value: string;
  size?: "sm" | "md";
  tone?: "muted" | "active";
  className?: string;
}

export function HotkeyChips({ value, size = "sm", tone = "muted", className = "" }: HotkeyChipsProps) {
  const parts = value.split("+").map((p) => p.trim()).filter(Boolean);
  const fontSize = size === "md" ? 11 : 10;
  const padX = size === "md" ? "var(--space-2)" : "6px";
  const padY = size === "md" ? "3px" : "2px";

  const keyColor = tone === "active" ? "var(--text-primary)" : "var(--text-secondary)";
  const bg = tone === "active" ? "var(--bg-elevated)" : "var(--bg-raised)";
  const border = tone === "active" ? "var(--border)" : "var(--border-subtle)";

  return (
    <span className={`inline-flex items-center gap-[6px] ${className}`}>
      {parts.map((part, i) => (
        <span key={`${part}-${i}`} className="inline-flex items-center gap-[6px]">
          <kbd
            className="inline-flex items-center font-[var(--font-mono)] rounded-[var(--radius-md)]"
            style={{
              fontSize,
              fontWeight: 400,
              color: keyColor,
              background: bg,
              border: `1px solid ${border}`,
              padding: `${padY} ${padX}`,
              lineHeight: 1,
              minWidth: size === "md" ? 22 : 18,
              justifyContent: "center",
            }}
          >
            {part}
          </kbd>
          {i < parts.length - 1 && (
            <span
              className="font-[var(--font-mono)] text-[var(--text-ghost)]"
              style={{ fontSize, lineHeight: 1 }}
            >
              +
            </span>
          )}
        </span>
      ))}
    </span>
  );
}
