import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { Plus, Pencil, Trash2, Upload, Check, X } from "lucide-react";
import { Section } from "../components/Section";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Switch } from "../components/ui/Switch";
import { toast } from "../components/ui/Toast";
import { useVocabularyStore } from "../store/vocabulary";
import { vocabularyImportCsv } from "../lib/invoke";
import type { VocabularyRule } from "../lib/invoke";

type Kind = VocabularyRule["kind"];

interface FormState {
  term: string;
  replacement: string;
  kind: Kind;
  caseSensitive: boolean;
}

const EMPTY_FORM: FormState = {
  term: "",
  replacement: "",
  kind: "exactWord",
  caseSensitive: false,
};

function applyRule(form: FormState, sample: string): string {
  if (!form.term) return sample;
  let pattern: string;
  if (form.kind === "exactWord") {
    pattern = `\\b${escapeRegex(form.term)}\\b`;
  } else if (form.kind === "prefix") {
    pattern = `\\b${escapeRegex(form.term)}`;
  } else {
    pattern = escapeRegex(form.term);
  }
  const flags = form.caseSensitive ? "g" : "gi";
  try {
    return sample.replace(new RegExp(pattern, flags), form.replacement);
  } catch {
    return sample;
  }
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function KindSegment({
  value,
  onChange,
}: {
  value: Kind;
  onChange: (v: Kind) => void;
}) {
  const options: { id: Kind; label: string }[] = [
    { id: "exactWord", label: "Exact Word" },
    { id: "prefix", label: "Prefix" },
    { id: "contains", label: "Contains" },
  ];
  return (
    <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border)] overflow-hidden">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            className={`px-[var(--space-3)] py-[6px] text-[11px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset ${
              active
                ? "bg-[var(--bg-raised)] text-[var(--text-primary)]"
                : "bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-raised)]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function KindBadge({ kind }: { kind: Kind }) {
  const label = kind === "exactWord" ? "exact" : kind === "prefix" ? "prefix" : "contains";
  return (
    <span
      className="inline-block px-[var(--space-2)] py-[2px] rounded-[var(--radius-sm)] text-[10px] font-[var(--font-mono)] uppercase tracking-[0.1em] border border-[var(--border-hairline)] text-[var(--text-tertiary)]"
    >
      {label}
    </span>
  );
}

export function Vocabulary() {
  const { rules, loadRules, addRule, updateRule, deleteRule } = useVocabularyStore();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [previewInput, setPreviewInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  function openAddForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setPreviewInput("");
    setFormOpen(true);
  }

  function openEditForm(rule: VocabularyRule) {
    setEditingId(rule.id);
    setForm({
      term: rule.term,
      replacement: rule.replacement,
      kind: rule.kind,
      caseSensitive: rule.caseSensitive,
    });
    setPreviewInput("");
    setFormOpen(true);
    setConfirmDeleteId(null);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setPreviewInput("");
  }

  async function handleSave() {
    if (!form.term.trim()) {
      toast("Term is required.", "error");
      return;
    }
    setSaving(true);
    try {
      if (editingId !== null) {
        await updateRule({ ...form, id: editingId });
      } else {
        await addRule(form);
      }
      closeForm();
    } catch (e) {
      toast(String(e), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteRule(id);
      if (confirmDeleteId === id) setConfirmDeleteId(null);
    } catch (e) {
      toast(String(e), "error");
    }
  }

  async function handleImport() {
    setImporting(true);
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (!selected) return;
      const path = selected as string;
      const content = await readTextFile(path);
      const count = await vocabularyImportCsv(content);
      await loadRules();
      toast(`Imported ${count} rule${count === 1 ? "" : "s"}.`);
    } catch (e) {
      toast(String(e), "error");
    } finally {
      setImporting(false);
    }
  }

  const previewOutput = applyRule(form, previewInput);
  const isEmpty = rules.length === 0;

  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      {/* Page header */}
      <div className="flex items-end justify-between">
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
        <div className="flex items-center gap-[var(--space-2)]">
          <Button variant="ghost" size="sm" onClick={handleImport} disabled={importing}>
            <Upload size={16} strokeWidth={1.6} className="mr-[var(--space-1)]" />
            Import CSV
          </Button>
          {!isEmpty && (
            <Button variant="default" size="sm" onClick={openAddForm} disabled={formOpen}>
              <Plus size={16} strokeWidth={1.6} className="mr-[var(--space-1)]" />
              Add rule
            </Button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {isEmpty && !formOpen && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-[var(--space-6)] py-[var(--space-12)] flex flex-col items-center gap-[var(--space-3)] text-center">
          <p className="text-[14px] font-medium text-[var(--text-primary)]">
            No replacement rules yet.
          </p>
          <p
            className="text-[12px] text-[var(--text-tertiary)] leading-relaxed"
            style={{ maxWidth: "44ch" }}
          >
            Teach Ello how to spell your team's names, product terms, and jargon.
          </p>
          <Button variant="default" size="sm" onClick={openAddForm} className="mt-[var(--space-2)]">
            <Plus size={16} strokeWidth={1.6} className="mr-[var(--space-1)]" />
            Add rule
          </Button>
        </div>
      )}

      {/* Rules table */}
      {!isEmpty && (
        <Section flush>
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-hairline)] overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] bg-[var(--bg-sunken)]">
                  <th className="text-left px-[var(--space-4)] py-[var(--space-2)] font-medium text-[var(--text-tertiary)] font-[var(--font-mono)] uppercase tracking-[0.1em] text-[10px]">
                    Term
                  </th>
                  <th className="px-[var(--space-2)] py-[var(--space-2)] text-[var(--text-ghost)] text-center w-6" aria-hidden="true">
                    →
                  </th>
                  <th className="text-left px-[var(--space-4)] py-[var(--space-2)] font-medium text-[var(--text-tertiary)] font-[var(--font-mono)] uppercase tracking-[0.1em] text-[10px]">
                    Replacement
                  </th>
                  <th className="text-left px-[var(--space-4)] py-[var(--space-2)] font-medium text-[var(--text-tertiary)] font-[var(--font-mono)] uppercase tracking-[0.1em] text-[10px]">
                    Kind
                  </th>
                  <th className="text-left px-[var(--space-4)] py-[var(--space-2)] font-medium text-[var(--text-tertiary)] font-[var(--font-mono)] uppercase tracking-[0.1em] text-[10px]">
                    Case
                  </th>
                  <th className="px-[var(--space-4)] py-[var(--space-2)] w-[120px]">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule, i) => {
                  const isConfirming = confirmDeleteId === rule.id;
                  const isEditing = editingId === rule.id && formOpen;
                  return (
                    <tr
                      key={rule.id ?? i}
                      className={`border-b border-[var(--border-hairline)] last:border-b-0 transition-colors duration-100 ${
                        isEditing ? "bg-[var(--bg-raised)]" : "hover:bg-[var(--bg-raised)]"
                      }`}
                    >
                      <td className="px-[var(--space-4)] py-[var(--space-3)] font-[var(--font-mono)] text-[12px] text-[var(--text-primary)]">
                        {rule.term}
                      </td>
                      <td className="px-[var(--space-2)] py-[var(--space-3)] text-[var(--text-ghost)] text-center" aria-hidden="true">
                        →
                      </td>
                      <td className="px-[var(--space-4)] py-[var(--space-3)] font-[var(--font-mono)] text-[12px] text-[var(--text-primary)]">
                        {rule.replacement}
                      </td>
                      <td className="px-[var(--space-4)] py-[var(--space-3)]">
                        <KindBadge kind={rule.kind} />
                      </td>
                      <td className="px-[var(--space-4)] py-[var(--space-3)] font-[var(--font-mono)] text-[11px] text-[var(--text-tertiary)]">
                        {rule.caseSensitive ? "Aa" : "aa"}
                      </td>
                      <td className="px-[var(--space-4)] py-[var(--space-3)]">
                        <div className="flex items-center justify-end gap-[var(--space-1)]">
                          {isConfirming ? (
                            <>
                              <span className="text-[11px] text-[var(--text-secondary)] mr-[var(--space-1)]">
                                Sure?
                              </span>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleDelete(rule.id!)}
                                aria-label="Confirm delete"
                              >
                                <Check size={16} strokeWidth={1.6} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmDeleteId(null)}
                                aria-label="Cancel delete"
                              >
                                <X size={16} strokeWidth={1.6} />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditForm(rule)}
                                aria-label={`Edit rule for ${rule.term}`}
                              >
                                <Pencil size={16} strokeWidth={1.6} />
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => setConfirmDeleteId(rule.id!)}
                                aria-label={`Delete rule for ${rule.term}`}
                              >
                                <Trash2 size={16} strokeWidth={1.6} />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Add / Edit form */}
      {formOpen && (
        <Section eyebrow={editingId !== null ? "Edit rule" : "New rule"} flush>
          <div className="flex flex-col gap-[var(--space-5)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-4)]">
              <div className="flex flex-col gap-[var(--space-2)]">
                <label className="text-[12px] text-[var(--text-primary)]">Term</label>
                <Input
                  value={form.term}
                  onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))}
                  placeholder="e.g. whisper"
                  className="font-[var(--font-mono)]"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-[var(--space-2)]">
                <label className="text-[12px] text-[var(--text-primary)]">Replacement</label>
                <Input
                  value={form.replacement}
                  onChange={(e) => setForm((f) => ({ ...f, replacement: e.target.value }))}
                  placeholder="e.g. Whisper"
                  className="font-[var(--font-mono)]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-[var(--space-6)]">
              <div className="flex flex-col gap-[var(--space-2)]">
                <span className="text-[12px] text-[var(--text-primary)]">Match kind</span>
                <KindSegment value={form.kind} onChange={(v) => setForm((f) => ({ ...f, kind: v }))} />
              </div>
              <div className="flex flex-col gap-[var(--space-2)]">
                <span className="text-[12px] text-[var(--text-primary)]">Case sensitive</span>
                <div className="flex items-center h-[30px]">
                  <Switch
                    checked={form.caseSensitive}
                    onChange={(v) => setForm((f) => ({ ...f, caseSensitive: v }))}
                    label="Case sensitive"
                  />
                </div>
              </div>
            </div>

            {/* Preview panel */}
            <div className="flex flex-col gap-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-[var(--space-4)] py-[var(--space-4)]">
              <span
                className="font-[var(--font-mono)] uppercase tracking-[0.14em] text-[10px] text-[var(--text-tertiary)]"
                style={{ lineHeight: 1 }}
              >
                Preview
              </span>
              <textarea
                value={previewInput}
                onChange={(e) => setPreviewInput(e.target.value)}
                placeholder="Type a sample phrase…"
                rows={2}
                className="w-full bg-[var(--bg-raised)] border border-[var(--border)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-[12px] font-[var(--font-mono)] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus-visible:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] transition-colors duration-150 resize-none"
              />
              <div
                className="min-h-[32px] px-[var(--space-3)] py-[var(--space-2)] rounded-[var(--radius-md)] bg-[var(--bg-base)] border border-[var(--border-hairline)] text-[12px] font-[var(--font-mono)] text-[var(--text-secondary)] whitespace-pre-wrap break-words"
                aria-label="Preview output"
              >
                {previewInput
                  ? previewOutput || <span className="text-[var(--text-ghost)]">(empty result)</span>
                  : <span className="text-[var(--text-ghost)]">Output will appear here…</span>}
              </div>
            </div>

            <div className="flex items-center gap-[var(--space-2)]">
              <Button variant="default" size="sm" onClick={handleSave} disabled={saving}>
                {saving ? (
                  "Saving…"
                ) : editingId !== null ? (
                  <>
                    <Check size={16} strokeWidth={1.6} className="mr-[var(--space-1)]" />
                    Save changes
                  </>
                ) : (
                  <>
                    <Plus size={16} strokeWidth={1.6} className="mr-[var(--space-1)]" />
                    Add rule
                  </>
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={closeForm} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
