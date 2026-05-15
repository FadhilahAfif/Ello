import { type ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`bg-[var(--bg-raised)] border border-[var(--border)] rounded-[var(--radius-lg)] p-[var(--space-4)] ${className}`}
    >
      {children}
    </div>
  );
}
