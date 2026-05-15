import type { ReactNode } from "react";

interface SectionProps {
  /** Eyebrow label (mono uppercase, tertiary) */
  eyebrow?: string;
  /** Title (Geist 20/500) */
  title?: string;
  /** Optional right-aligned meta */
  meta?: ReactNode;
  /** Body content rendered below the header */
  children?: ReactNode;
  /** Skip the bottom hairline divider */
  flush?: boolean;
  /** Anchor id for in-page nav */
  id?: string;
  className?: string;
}

export function Section({
  eyebrow,
  title,
  meta,
  children,
  flush = false,
  id,
  className = "",
}: SectionProps) {
  return (
    <section id={id} className={`scroll-mt-[var(--space-8)] ${className}`}>
      {(eyebrow || title || meta) && (
        <header
          className={`flex items-end justify-between gap-[var(--space-4)] ${
            flush ? "" : "pb-[var(--space-3)] border-b border-[var(--border-hairline)]"
          } mb-[var(--space-4)]`}
        >
          <div className="flex flex-col gap-[var(--space-1)]">
            {eyebrow && (
              <span
                className="font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px] text-[var(--text-tertiary)]"
                style={{ lineHeight: 1 }}
              >
                {eyebrow}
              </span>
            )}
            {title && (
              <h2
                className="text-[20px] font-medium text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-sans)", lineHeight: 1.2 }}
              >
                {title}
              </h2>
            )}
          </div>
          {meta && (
            <div className="font-[var(--font-mono)] text-[10px] text-[var(--text-tertiary)] uppercase tracking-[0.14em]">
              {meta}
            </div>
          )}
        </header>
      )}
      {children}
    </section>
  );
}
