import { type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "solid" | "ghost" | "danger";
  size?: "sm" | "md";
}

export function Button({ variant = "default", size = "md", className = "", ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-medium transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-base)] whitespace-nowrap";

  const variants = {
    /** Outline accent. Default per DESIGN.md (no amber background fills). */
    default:
      "bg-transparent text-[var(--accent)] border border-[var(--accent)] hover:bg-[var(--accent-glow)]",
    /** Reserved: filled amber. Use sparingly (sticky save bar primary). */
    solid:
      "bg-[var(--accent)] text-[var(--bg-base)] border border-[var(--accent)] hover:bg-[var(--accent-dim)] hover:border-[var(--accent-dim)]",
    ghost:
      "bg-transparent text-[var(--text-secondary)] border border-transparent hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)]",
    danger:
      "bg-transparent text-[var(--color-error)] border border-transparent hover:bg-[var(--bg-raised)]",
  };

  const sizes = {
    sm: "text-[11px] px-[var(--space-3)] py-[6px] rounded-[var(--radius-md)]",
    md: "text-[13px] px-[var(--space-4)] py-[var(--space-2)] rounded-[var(--radius-md)]",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
