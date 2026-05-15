import { type ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "accent" | "error";
  className?: string;
}

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  const variants = {
    default: "bg-[var(--bg-raised)] text-[var(--text-tertiary)] border-[var(--border)]",
    accent: "bg-[var(--bg-raised)] text-[var(--accent)] border-[var(--border)]",
    error: "bg-[var(--bg-raised)] text-[var(--color-error)] border-[var(--color-error-border)]",
  };
  return (
    <span className={`inline-flex items-center px-[var(--space-2)] py-[var(--space-1)] text-[10px] font-mono rounded-[var(--radius-md)] border ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
