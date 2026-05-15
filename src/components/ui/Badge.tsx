import { type ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "accent" | "error";
}

export function Badge({ children, variant = "default" }: BadgeProps) {
  const variants = {
    default: "bg-[var(--bg-raised)] text-[var(--text-tertiary)] border-[var(--border)]",
    accent: "bg-[var(--bg-raised)] text-[var(--accent)] border-[var(--border)]",
    error: "bg-[var(--bg-raised)] text-red-400 border-[var(--border)]",
  };
  return (
    <span className={`inline-flex items-center px-[var(--space-2)] py-[var(--space-1)] text-[10px] font-mono rounded-[var(--radius-md)] border ${variants[variant]}`}>
      {children}
    </span>
  );
}
