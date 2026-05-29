import { useState, useEffect, useCallback } from "react";
import { BookOpen, Plus, Trash2, Check, X } from "lucide-react";
import { Section } from "../components/Section";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Switch } from "../components/ui/Switch";
import { toast } from "../components/ui/Toast";
import {
  vocabularyList,
  vocabularyUpsert,
  vocabularyDelete,
  vocabularyImportCsv,
  type VocabularyRule,
  type VocabularyKind,
} from "../lib/invoke";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";

// ── Client-side apply_rules port ─────────────────────────────────────────────

function replaceWordBoundary(text: string, term: string, replacement: string, caseSensitive: boolean): string {
  let result = "";
  let remaining = text;
  const needle = caseSensitive ? term : term.toLowerCase();
  while (remaining.length > 0) {
    const haystack = caseSensitive ? remaining : remaining.toLowerCase();
    const pos = haystack.indexOf(needle);
    if (pos === -1) { result += remaining; break; }
    const before = remaining.slice(0, pos);
    const after = remaining.slice(pos + term.length);
    const atWordStart = pos === 0 || !/[\w]/.test(before[before.length - 1]);
    const atWordEnd = after.length === 0 || !/[\w]/.test(after[0]);
    if (atWordStart && atWordEnd) {
      result += before + replacement;
    } else {
      result += before + remaining.slice(pos, pos + term.length);
    }
    remaining = after;
  }
  return result;
}

function replaceCaseInsensitive(text: string, term: string, replacement: string): string {
  const lower = text.toLowerCase();
  const needle = term.toLowerCase();
  let result = "";
  let last = 0;
  let start = 0;
  while (true) {
    const pos = lower.indexOf(needle, start);
    if (pos === -1) { result += text.slice(last); break; }
    result += text.slice(last, pos) + replacement;
    last = pos + term.length;
    start = last;
  }
  return result;
}

function replacePrefix(text: string, prefix: string, replacement: string, caseSensitive: boolean): string {
  return text.split(/(\s+)/).map((token) => {
    if (/^\s+$/.test(token)) return token;
    const matches = caseSensitive
      ? token.startsWith(prefix)
      : token.toLowerCase().startsWith(prefix.toLowerCase());
    if (matches) return replacement + token.slice(prefix.length);
    return token;
  }).join("");
}

function applyRules(text: string, rules: VocabularyRule[]): string {
  let result = text;
  for (const rule of rules) {
    switch (rule.kind) {
      case "exact":
        result = replaceWordBoundary(result, rule.term, rule.replacement, rule.caseSensitive);
        break;
      case "contains":
        result = rule.caseSensitive
          ? result.split(rule.term).join(rule.replacement)
          : replaceCaseInsensitive(result, rule.term, rule.replacement);
        break;
      case "prefix":
        result = replacePrefix(result, rule.term, rule.replacement, rule.caseSensitive);
        break;
    }
  }
  return result;
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-[var(--space-4)] py-[var(--space-10)] px-[var(--space-6)]">
      <BookOpen size={32} strokeWidth={1.2} className="text-[var(--text-ghost)]" aria-hidden="true" />
      <div className="flex flex-col items-center gap-[var(--space-1)] text-center">
        <span className="text-[14px] font-medium text-[var(--text-secondary)]">No rules yet</span>
        <span className="text-[12px] text-[var(--text-tertiary)] max-w-[36ch]">
          Add a rule to teach Ello how to spell your team's names, product terms, and jargon.
        </span>
      </div>
      <Button size="sm" onClick={onAdd}>
        <Plus size={12} strokeWidth={1.6} className="mr-[var(--space-1)]" aria-hidden="true" />
        Add your first rule
      </Button>
    </div>
  );
}

// ── Row editor ────────────────────────────────────────────────────────────────

interface EditState {
  term: string;
  replacement: string;
  kind: VocabularyKind;
  caseSensitive: boolean;
}

const BLANK_EDIT: EditState = { term: "", replacement: "", kind: "exact", caseSensitive: false };

interface RuleRowProps {
  rule: VocabularyRule;
  onSave: (id: number, edit: EditState) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

function RuleRow({ rule, onSave, onDelete }: RuleRowProps) {
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<EditState>({
    term: rule.term,
    replacement: rule.replacement,
    kind: rule.kind,
    caseSensitive: rule.caseSensitive,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!edit.term.trim()) return;
    setSaving(true);
    await onSave(rule.id, edit);
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setEdit({ term: rule.term, replacement: rule.replacement, kind: rule.kind, caseSensitive: rule.caseSensitive });
    setEditing(false);
  };

  if (editing) {
    return (
      <tr className="border-b border-[var(--border-hairline)] bg-[var(--bg-elevated)]">
        <td className="px-[var(--space-3)] py-[var(--space-2)]">
          <Input value={edit.term} onChange={(e) => setEdit((s) => ({ ...s, term: e.target.value }))} placeholder="term" autoFocus />
        </td>
        <td className="px-[var(--space-3)] py-[var(--space-2)]">
          <Input value={edit.replacement} onChange={(e) => setEdit((s) => ({ ...s, replacement: e.target.value }))} placeholder="replacement" />
        </td>
        <td className="px-[var(--space-3)] py-[var(--space-2)] w-[120px]">
          <Select value={edit.kind} onChange={(e) => setEdit((s) => ({ ...s, kind: e.target.value as VocabularyKind }))}>
            <option value="exact">Exact word</option>
            <option value="prefix">Prefix</option>
            <option value="contains">Contains</option>
          </Select>
        </td>
        <td className="px-[var(--space-3)] py-[var(--space-2)] w-[80px] text-center">
          <Switch checked={edit.caseSensitive} onChange={(v) => setEdit((s) => ({ ...s, caseSensitive: v }))} label="Case sensitive" />
        </td>
        <td className="px-[var(--space-3)] py-[var(--space-2)] w-[80px]">
          <div className="flex items-center gap-[var(--space-1)]">
            <button
              onClick={handleSave}
              disabled={saving || !edit.term.trim()}
              aria-label="Save rule"
              className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--accent)] hover:bg-[var(--accent-glow)] disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <Check size={14} strokeWidth={1.6} />
            </button>
            <button
              onClick={handleCancel}
              aria-label="Cancel edit"
              className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <X size={14} strokeWidth={1.6} />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr
      className="border-b border-[var(--border-hairline)] hover:bg-[var(--bg-elevated)] cursor-pointer group transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
      tabIndex={0}
      aria-label={`Edit rule: ${rule.term} → ${rule.replacement}`}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); setEditing(true); } }}
    >
      <td className="px-[var(--space-3)] py-[var(--space-3)] font-[var(--font-mono)] text-[12px] text-[var(--text-primary)]">{rule.term}</td>
      <td className="px-[var(--space-3)] py-[var(--space-3)] font-[var(--font-mono)] text-[12px] text-[var(--text-secondary)]">{rule.replacement}</td>
      <td className="px-[var(--space-3)] py-[var(--space-3)] text-[12px] text-[var(--text-tertiary)] w-[120px]">{rule.kind}</td>
      <td className="px-[var(--space-3)] py-[var(--space-3)] w-[80px] text-center">
        <span className={`inline-block w-[6px] h-[6px] rounded-full ${rule.caseSensitive ? "bg-[var(--accent)]" : "bg-[var(--text-ghost)]"}`} aria-label={rule.caseSensitive ? "Case sensitive" : "Case insensitive"} />
      </td>
      <td className="px-[var(--space-3)] py-[var(--space-3)] w-[80px]">
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(rule.id); }}
          aria-label={`Delete rule for "${rule.term}"`}
          className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-error)] hover:bg-[var(--bg-raised)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:opacity-100"
        >
          <Trash2 size={13} strokeWidth={1.6} />
        </button>
      </td>
    </tr>
  );
}

// ── New row ───────────────────────────────────────────────────────────────────

interface NewRowProps {
  onSave: (edit: EditState) => Promise<void>;
  onCancel: () => void;
}

function NewRow({ onSave, onCancel }: NewRowProps) {
  const [edit, setEdit] = useState<EditState>(BLANK_EDIT);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!edit.term.trim()) return;
    setSaving(true);
    await onSave(edit);
    setSaving(false);
  };

  return (
    <tr className="border-b border-[var(--border-hairline)] bg-[var(--bg-elevated)]">
      <td className="px-[var(--space-3)] py-[var(--space-2)]">
        <Input value={edit.term} onChange={(e) => setEdit((s) => ({ ...s, term: e.target.value }))} placeholder="term" autoFocus />
      </td>
      <td className="px-[var(--space-3)] py-[var(--space-2)]">
        <Input value={edit.replacement} onChange={(e) => setEdit((s) => ({ ...s, replacement: e.target.value }))} placeholder="replacement" />
      </td>
      <td className="px-[var(--space-3)] py-[var(--space-2)] w-[120px]">
        <Select value={edit.kind} onChange={(e) => setEdit((s) => ({ ...s, kind: e.target.value as VocabularyKind }))}>
          <option value="exact">Exact word</option>
          <option value="prefix">Prefix</option>
          <option value="contains">Contains</option>
        </Select>
      </td>
      <td className="px-[var(--space-3)] py-[var(--space-2)] w-[80px] text-center">
        <Switch checked={edit.caseSensitive} onChange={(v) => setEdit((s) => ({ ...s, caseSensitive: v }))} label="Case sensitive" />
      </td>
      <td className="px-[var(--space-3)] py-[var(--space-2)] w-[80px]">
        <div className="flex items-center gap-[var(--space-1)]">
          <button
            onClick={handleSave}
            disabled={saving || !edit.term.trim()}
            aria-label="Save new rule"
            className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--accent)] hover:bg-[var(--accent-glow)] disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <Check size={14} strokeWidth={1.6} />
          </button>
          <button
            onClick={onCancel}
            aria-label="Cancel new rule"
            className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <X size={14} strokeWidth={1.6} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function Vocabulary() {
  const [rules, setRules] = useState<VocabularyRule[]>([]);
  const [adding, setAdding] = useState(false);
  const [previewInput, setPreviewInput] = useState("");
  const [importing, setImporting] = useState(false);

  const loadRules = useCallback(async () => {
    try {
      const list = await vocabularyList();
      setRules(list);
    } catch (e) {
      toast(String(e), "error");
    }
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  const handleSaveExisting = useCallback(async (id: number, edit: EditState) => {
    try {
      await vocabularyUpsert({ id, ...edit });
      await loadRules();
    } catch (e) {
      toast(String(e), "error");
    }
  }, [loadRules]);

  const handleSaveNew = useCallback(async (edit: EditState) => {
    try {
      await vocabularyUpsert({ id: null, ...edit });
      setAdding(false);
      await loadRules();
    } catch (e) {
      toast(String(e), "error");
    }
  }, [loadRules]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await vocabularyDelete(id);
      await loadRules();
    } catch (e) {
      toast(String(e), "error");
    }
  }, [loadRules]);

  const handleImport = useCallback(async () => {
    setImporting(true);
    try {
      const path = await open({
        filters: [{ name: "CSV", extensions: ["csv"] }],
        multiple: false,
        directory: false,
      });
      if (!path) return;
      const csv = await readTextFile(path as string);
      const count = await vocabularyImportCsv(csv);
      toast(`Imported ${count} rule${count === 1 ? "" : "s"}`);
      await loadRules();
    } catch (e) {
      toast(String(e), "error");
    } finally {
      setImporting(false);
    }
  }, [loadRules]);

  const previewOutput = applyRules(previewInput, rules);

  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        <span
          className="font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px] text-[var(--text-tertiary)]"
          style={{ lineHeight: 1 }}
        >
          Replacements
        </span>
        <h1
          className="text-[24px] font-medium text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-sans)", lineHeight: 1.2, letterSpacing: "-0.01em" }}
        >
          Vocabulary
        </h1>
      </div>

      {/* Rules table */}
      <Section
        eyebrow="Rules"
        title="Replacement rules"
        meta={
          <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
            <Plus size={12} strokeWidth={1.6} className="mr-[var(--space-1)]" aria-hidden="true" />
            Add rule
          </Button>
        }
      >
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-hairline)] overflow-hidden">
          {rules.length === 0 && !adding ? (
            <EmptyState onAdd={() => setAdding(true)} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-hairline)]">
                    <th className="px-[var(--space-3)] py-[var(--space-2)] text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-[var(--font-mono)]">Term</th>
                    <th className="px-[var(--space-3)] py-[var(--space-2)] text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-[var(--font-mono)]">Replacement</th>
                    <th className="px-[var(--space-3)] py-[var(--space-2)] text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-[var(--font-mono)] w-[120px]">Kind</th>
                    <th className="px-[var(--space-3)] py-[var(--space-2)] text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-[var(--font-mono)] w-[80px] text-center">Case</th>
                    <th className="px-[var(--space-3)] py-[var(--space-2)] w-[80px]" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {adding && (
                    <NewRow onSave={handleSaveNew} onCancel={() => setAdding(false)} />
                  )}
                  {rules.map((rule) => (
                    <RuleRow
                      key={rule.id}
                      rule={rule}
                      onSave={handleSaveExisting}
                      onDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>

      {/* Live preview */}
      <Section eyebrow="Preview" title="Live preview">
        <div className="grid grid-cols-2 gap-[var(--space-4)]">
          <div className="flex flex-col gap-[var(--space-2)]">
            <label htmlFor="vocab-preview-input" className="text-[11px] text-[var(--text-tertiary)] font-[var(--font-mono)] uppercase tracking-[0.12em]">
              Input
            </label>
            <textarea
              id="vocab-preview-input"
              value={previewInput}
              onChange={(e) => setPreviewInput(e.target.value)}
              placeholder="Type something to preview your rules…"
              rows={5}
              className="w-full bg-[var(--bg-raised)] border border-[var(--border)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus-visible:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] transition-colors duration-150 resize-none font-[var(--font-mono)]"
            />
          </div>
          <div className="flex flex-col gap-[var(--space-2)]">
            <label htmlFor="vocab-preview-output" className="text-[11px] text-[var(--text-tertiary)] font-[var(--font-mono)] uppercase tracking-[0.12em]">
              Output
            </label>
            <textarea
              id="vocab-preview-output"
              value={previewOutput}
              readOnly
              rows={5}
              aria-label="Preview output after rules applied"
              className="w-full bg-[var(--bg-sunken)] border border-[var(--border-hairline)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-[13px] text-[var(--text-secondary)] outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)] resize-none font-[var(--font-mono)] cursor-default"
            />
          </div>
        </div>
      </Section>

      {/* CSV import */}
      <Section eyebrow="Import" title="Import from CSV">
        <div className="flex flex-col gap-[var(--space-3)]">
          <p className="text-[12px] text-[var(--text-tertiary)]">
            CSV format:{" "}
            <code className="font-[var(--font-mono)] text-[var(--text-secondary)]">
              term,replacement,case_sensitive,kind
            </code>
            {" "}— header row is skipped. <code className="font-[var(--font-mono)]">case_sensitive</code> is 0 or 1.{" "}
            <code className="font-[var(--font-mono)]">kind</code> is <code className="font-[var(--font-mono)]">exact</code>,{" "}
            <code className="font-[var(--font-mono)]">prefix</code>, or <code className="font-[var(--font-mono)]">contains</code>.
          </p>
          <div>
            <Button size="sm" variant="ghost" onClick={handleImport} disabled={importing}>
              {importing ? "Importing…" : "Import CSV"}
            </Button>
          </div>
        </div>
      </Section>
    </div>
  );
}
