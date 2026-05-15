interface CursorBlockProps {
  /** Animation: 'none' (static), 'pulse' (slow fade for idle), 'blink' (1s step for active) */
  animate?: "none" | "pulse" | "blink";
  /** Visual size: matches Geist cap heights at common sizes. */
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_MAP: Record<NonNullable<CursorBlockProps["size"]>, { w: number; h: number; ml: number }> = {
  sm: { w: 5, h: 11, ml: 2 },   // Sidebar wordmark, inline body
  md: { w: 7, h: 16, ml: 3 },   // Page-level wordmark
  lg: { w: 10, h: 22, ml: 4 },  // Section-level
  xl: { w: 14, h: 30, ml: 5 },  // Hero
};

export function CursorBlock({ animate = "none", size = "sm", className = "" }: CursorBlockProps) {
  const dims = SIZE_MAP[size];
  const animationStyle =
    animate === "blink"
      ? { animation: "cursor-blink 1s step-start infinite" }
      : animate === "pulse"
        ? { animation: "cursor-pulse 2.4s ease-in-out infinite" }
        : undefined;

  return (
    <span
      aria-hidden="true"
      className={`inline-block align-baseline ${className}`}
      style={{
        width: dims.w,
        height: dims.h,
        marginLeft: dims.ml,
        background: "var(--accent)",
        borderRadius: "var(--radius-sm)",
        verticalAlign: "-2px",
        ...animationStyle,
      }}
    />
  );
}
