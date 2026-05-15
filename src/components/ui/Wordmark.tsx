import { CursorBlock } from "./CursorBlock";

interface WordmarkProps {
  size?: "sm" | "md" | "lg";
  /** Render as button-like clickable mark */
  onClick?: () => void;
  className?: string;
}

const TEXT_SIZES = {
  sm: 14,
  md: 22,
  lg: 32,
};

const CURSOR_SIZE_MAP = {
  sm: "sm",
  md: "md",
  lg: "lg",
} as const;

export function Wordmark({ size = "sm", onClick, className = "" }: WordmarkProps) {
  const fontSize = TEXT_SIZES[size];
  const Tag = onClick ? "button" : "span";

  return (
    <Tag
      onClick={onClick}
      aria-label="Ello"
      className={`inline-flex items-baseline ${
        onClick
          ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-sunken)] rounded-[var(--radius-sm)]"
          : ""
      } ${className}`}
      style={{
        fontFamily: "var(--font-mono)",
        fontWeight: 500,
        letterSpacing: "-0.03em",
        fontSize,
        color: "var(--text-primary)",
        lineHeight: 1,
        background: "transparent",
        border: 0,
        padding: 0,
      }}
    >
      ello
      <CursorBlock size={CURSOR_SIZE_MAP[size]} />
    </Tag>
  );
}
