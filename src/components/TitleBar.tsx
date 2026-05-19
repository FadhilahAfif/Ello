import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { Wordmark } from "./ui/Wordmark";

export function TitleBar() {
  const win = getCurrentWindow();

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-9 shrink-0 bg-[var(--bg-sunken)] border-b border-[var(--border-subtle)] pl-[var(--space-3)]"
    >
      <div className="no-drag flex items-center">
        <Wordmark size="sm" />
      </div>

      <div className="no-drag flex items-center">
        <button
          onClick={() => win.minimize()}
          aria-label="Minimize"
          title="Minimize"
          className="flex items-center justify-center w-11 h-9 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-raised)] transition-colors duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
        >
          <Minus size={12} strokeWidth={1.6} />
        </button>
        <button
          onClick={() => win.toggleMaximize()}
          aria-label="Maximize"
          title="Maximize"
          className="flex items-center justify-center w-11 h-9 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-raised)] transition-colors duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
        >
          <Square size={11} strokeWidth={1.6} />
        </button>
        <button
          onClick={() => win.close()}
          aria-label="Close"
          title="Close"
          className="flex items-center justify-center w-11 h-9 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[#7f1d1d] transition-colors duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
        >
          <X size={12} strokeWidth={1.6} />
        </button>
      </div>
    </div>
  );
}
