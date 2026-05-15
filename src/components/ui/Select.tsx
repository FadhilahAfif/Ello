import { type SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className = "", children, ...props }: SelectProps) {
  return (
    <div className="relative w-full">
      <select
        className={`w-full appearance-none bg-[var(--bg-raised)] border border-[var(--border)] rounded-[var(--radius-md)] pl-[var(--space-3)] pr-[var(--space-8)] py-[var(--space-2)] text-[13px] text-[var(--text-primary)] outline-none focus-visible:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] transition-colors duration-150 cursor-pointer ${className}`}
        {...props}
      >
        {children}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-[var(--space-3)] top-1/2 -translate-y-1/2 font-[var(--font-mono)] text-[10px] text-[var(--text-tertiary)]"
      >
        ▾
      </span>
    </div>
  );
}
