import { useState, useEffect, useCallback } from "react";

interface ToastItem {
  id: number;
  message: string;
  variant: "info" | "error";
}

let toastId = 0;
let addToastFn: ((message: string, variant?: "info" | "error") => void) | null = null;

export function toast(message: string, variant: "info" | "error" = "info") {
  addToastFn?.(message, variant);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const add = useCallback((message: string, variant: "info" | "error" = "info") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV && addToastFn !== null) {
      console.warn("ToastContainer: multiple instances detected — only one should be mounted");
    }
    addToastFn = add;
    return () => { addToastFn = null; };
  }, [add]);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 flex flex-col gap-2 z-50"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start justify-between gap-[var(--space-2)] px-[var(--space-3)] py-[var(--space-2)] rounded-[var(--radius-lg)] text-[13px] border min-w-[200px] max-w-[320px] ${
            t.variant === "error"
              ? "bg-[var(--bg-raised)] border-[var(--color-error-border)] text-[var(--color-error)]"
              : "bg-[var(--bg-raised)] border-[var(--border)] text-[var(--text-primary)]"
          }`}
        >
          <span>{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss notification"
            className="shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors leading-none"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
