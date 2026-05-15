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

  useEffect(() => {
    addToastFn = add;
    return () => { addToastFn = null; };
  }, [add]);

  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-[var(--space-3)] py-[var(--space-2)] rounded-[var(--radius-lg)] text-[13px] border ${
            t.variant === "error"
              ? "bg-[var(--bg-raised)] border-red-900 text-red-400"
              : "bg-[var(--bg-raised)] border-[var(--border)] text-[var(--text-primary)]"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
