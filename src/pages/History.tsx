import { useState, useEffect, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, Copy, Trash2, Download, BookOpen } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { Section } from "../components/Section";
import { Button } from "../components/ui/Button";
import { toast } from "../components/ui/Toast";
import {
  historyList,
  historyDelete,
  historyClear,
  historyExport,
  type HistoryItem,
} from "../lib/invoke";
import { formatDuration } from "../lib/format";

const PAGE_SIZE = 100;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function History() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmClear, setConfirmClear] = useState(false);
  const [exportFormat, setExportFormat] = useState<"txt" | "json" | "markdown">("txt");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const rows = await historyList(q || null, PAGE_SIZE, 0);
      setItems(rows);
      setSelected(new Set());
    } catch (e) {
      toast(`Failed to load history: ${String(e)}`, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  useEffect(() => {
    load(debouncedQuery);
  }, [debouncedQuery, load]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 10,
  });

  const handleDelete = async (id: number) => {
    try {
      await historyDelete(id);
      setItems((prev) => prev.filter((r) => r.id !== id));
      setSelected((prev) => { const s = new Set(prev); s.delete(id); return s; });
    } catch (e) {
      toast(`Delete failed: ${String(e)}`, "error");
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast("Copied to clipboard");
    }).catch(() => {
      toast("Copy failed", "error");
    });
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((r) => r.id)));
    }
  };

  const handleExport = async () => {
    let ids: number[];
    if (selected.size > 0) {
      ids = Array.from(selected);
    } else {
      const all = await historyList(debouncedQuery || null, 100_000, 0);
      ids = all.map((r) => r.id);
    }
    if (ids.length === 0) return;
    try {
      const ext = exportFormat === "markdown" ? "md" : exportFormat;
      const filePath = await save({
        title: "Export transcripts",
        defaultPath: `ello-history.${ext}`,
        filters: [{ name: "Text files", extensions: [ext] }],
      });
      if (!filePath) return;
      const text = await historyExport(ids, exportFormat);
      await writeTextFile(filePath, text);
      toast(`Exported ${ids.length} transcript${ids.length !== 1 ? "s" : ""}`);
    } catch (e) {
      toast(`Export failed: ${String(e)}`, "error");
    }
  };

  const handleClearAll = async () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    try {
      await historyClear();
      setItems([]);
      setSelected(new Set());
      setConfirmClear(false);
      toast("History cleared");
    } catch (e) {
      toast(`Clear failed: ${String(e)}`, "error");
      setConfirmClear(false);
    }
  };

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        <span
          className="font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px] text-[var(--text-tertiary)]"
          style={{ lineHeight: 1 }}
        >
          Transcripts
        </span>
        <h1
          className="text-[24px] font-medium text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-sans)", lineHeight: 1.2, letterSpacing: "-0.01em" }}
        >
          History
        </h1>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-[var(--space-3)] flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={13}
            strokeWidth={1.6}
            className="absolute left-[var(--space-3)] top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transcripts…"
            aria-label="Search transcripts"
            className="w-full pl-[28px] pr-[var(--space-3)] py-[var(--space-2)] bg-[var(--bg-raised)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] font-[var(--font-mono)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-base)]"
          />
        </div>

        <div className="flex items-center gap-[var(--space-2)]">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as typeof exportFormat)}
            aria-label="Export format"
            className="bg-[var(--bg-raised)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] font-[var(--font-mono)] text-[11px] text-[var(--text-secondary)] px-[var(--space-2)] py-[var(--space-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <option value="txt">TXT</option>
            <option value="json">JSON</option>
            <option value="markdown">MD</option>
          </select>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleExport}
            disabled={items.length === 0}
            aria-label="Export transcripts"
          >
            <Download size={13} strokeWidth={1.6} aria-hidden="true" />
            <span>{selected.size > 0 ? `Export (${selected.size})` : "Export all"}</span>
          </Button>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={handleClearAll}
          disabled={items.length === 0}
          aria-label={confirmClear ? "Confirm clear all history" : "Clear all history"}
          className={confirmClear ? "text-[var(--color-error)] border-[var(--color-error-border)]" : ""}
          onBlur={() => setConfirmClear(false)}
        >
          {confirmClear ? "Confirm clear?" : "Clear all"}
        </Button>
      </div>

      {/* Count + select-all */}
      {items.length > 0 && (
        <div className="flex items-center gap-[var(--space-4)]">
          <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            {loading ? "Loading…" : `${items.length} transcript${items.length !== 1 ? "s" : ""}${debouncedQuery ? " matched" : ""}`}
          </span>
          <button
            onClick={toggleSelectAll}
            className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            {selected.size === items.length && items.length > 0 ? "Deselect all" : "Select all"}
          </button>
        </div>
      )}

      {/* List */}
      <Section flush>
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-[var(--space-16)]">
            <span className="font-[var(--font-mono)] text-[11px] text-[var(--text-tertiary)] uppercase tracking-[0.14em]">
              Loading…
            </span>
          </div>
        ) : items.length === 0 ? (
          <EmptyState hasQuery={!!debouncedQuery} />
        ) : (
          <div
            ref={parentRef}
            className="overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border-hairline)]"
            style={{ height: Math.min(items.length * 88, 560) }}
            aria-label="Transcript history list"
          >
            <div
              style={{ height: virtualizer.getTotalSize(), position: "relative" }}
            >
              {virtualItems.map((vItem) => {
                const item = items[vItem.index];
                const isSelected = selected.has(item.id);
                return (
                  <div
                    key={item.id}
                    data-index={vItem.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${vItem.start}px)`,
                    }}
                  >
                    <HistoryRow
                      item={item}
                      selected={isSelected}
                      onToggleSelect={() => toggleSelect(item.id)}
                      onCopy={() => handleCopy(item.text)}
                      onDelete={() => handleDelete(item.id)}
                      isLast={vItem.index === items.length - 1}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

function HistoryRow({
  item,
  selected,
  onToggleSelect,
  onCopy,
  onDelete,
  isLast,
}: {
  item: HistoryItem;
  selected: boolean;
  onToggleSelect: () => void;
  onCopy: () => void;
  onDelete: () => void;
  isLast: boolean;
}) {
  return (
    <div
      className={`group flex items-start gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-4)] bg-[var(--bg-surface)] transition-colors duration-100 hover:bg-[var(--bg-raised)] ${
        !isLast ? "border-b border-[var(--border-hairline)]" : ""
      } ${selected ? "bg-[var(--bg-raised)]" : ""}`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        aria-label={`Select transcript from ${item.createdAt}`}
        className="mt-[3px] shrink-0 accent-[var(--accent)] w-[13px] h-[13px] cursor-pointer"
      />
      <div className="flex-1 min-w-0 flex flex-col gap-[var(--space-1)]">
        <p
          className="font-[var(--font-mono)] text-[12px] text-[var(--text-primary)] line-clamp-2"
          style={{ lineHeight: 1.6 }}
        >
          {item.text}
        </p>
        <div className="flex items-center gap-[var(--space-3)] flex-wrap">
          <span className="font-[var(--font-mono)] text-[10px] text-[var(--text-tertiary)]">
            {formatDate(item.createdAt)}
          </span>
          <span className="font-[var(--font-mono)] text-[10px] text-[var(--text-ghost)]">
            {item.wordCount}w · {formatDuration(item.durationMs)} · {item.mode}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-[var(--space-1)] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 shrink-0">
        <button
          onClick={onCopy}
          aria-label="Copy transcript"
          title="Copy"
          className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <Copy size={13} strokeWidth={1.6} aria-hidden="true" />
        </button>
        <button
          onClick={onDelete}
          aria-label="Delete transcript"
          title="Delete"
          className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--bg-elevated)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <Trash2 size={13} strokeWidth={1.6} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-[var(--space-6)] py-[var(--space-10)] flex flex-col items-start gap-[var(--space-4)]">
      <BookOpen size={20} strokeWidth={1.4} className="text-[var(--text-ghost)]" aria-hidden="true" />
      <div className="flex flex-col gap-[var(--space-2)]">
        <p className="text-[14px] font-medium text-[var(--text-primary)]" style={{ fontFamily: "var(--font-sans)" }}>
          {hasQuery ? "No transcripts matched" : "No transcripts yet"}
        </p>
        <p className="font-[var(--font-mono)] text-[12px] text-[var(--text-secondary)]" style={{ maxWidth: "52ch", lineHeight: 1.7 }}>
          {hasQuery
            ? "Try a different search term or clear the query to see all transcripts."
            : "Press your hotkey to record. Each transcript is automatically saved here."}
        </p>
      </div>
    </div>
  );
}
