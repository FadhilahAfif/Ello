import { type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "ghost" | "danger";
  size?: "sm" | "md";
}

export function Button({ variant = "default", size = "md", className = "", ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-base)]";
  const variants = {
    default: "bg-[var(--accent)] text-[var(--bg-base)] hover:bg-[var(--accent-dim)]",
    ghost: "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)]",
    danger: "bg-transparent text-[var(--color-error)] hover:bg-[var(--bg-raised)]",
  };
  const sizes = {
    sm: "text-[11px] px-[var(--space-2)] py-[var(--space-1)] rounded-[var(--radius-md)]",
    md: "text-[13px] px-[var(--space-3)] py-[var(--space-2)] rounded-[var(--radius-lg)]",
  };
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
