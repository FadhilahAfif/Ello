import { type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`w-full bg-[var(--bg-raised)] border border-[var(--border)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus-visible:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] transition-colors duration-150 ${className}`}
      {...props}
    />
  );
}
