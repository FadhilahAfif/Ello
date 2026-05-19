import { useState, useEffect } from "react";
import { useSettingsStore } from "../store/settings";
import type { ModelStatus } from "../store/settings";
import { getModelManifest, downloadModel, cancelDownload, checkInstalledModels } from "../lib/invoke";
import type { ModelManifestEntry } from "../lib/invoke";
import {
  onModelDownloadProgress, onModelDownloadDone,
  onModelDownloadError, onModelDownloadCancelled,
} from "../lib/events";
import { Button } from "../components/ui/Button";
import { Section } from "../components/Section";
import { Check, Download, X, Loader2, FolderOpen } from "lucide-react";

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1_048_576).toFixed(0)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
};

export function Models() {
  const { settings, patchSetting, setError } = useSettingsStore();
  const [manifest, setManifest] = useState<ModelManifestEntry[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ModelStatus>>({});

  useEffect(() => {
    getModelManifest().then(setManifest).catch(console.error);
  }, []);

  useEffect(() => {
    let mounted = true;
    checkInstalledModels()
      .then((installed) => {
        if (!mounted) return;
        setStatuses((prev) => {
          const next = { ...prev };
          for (const [id, path] of Object.entries(installed)) {
            if (!next[id] || next[id].kind === "idle") {
              next[id] = { kind: "installed", path };
            }
          }
          return next;
        });
      })
      .catch(console.error);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    const unlisteners: Array<() => void> = [];
    Promise.all([
      onModelDownloadProgress(({ id, downloaded, total, validating }) => {
        setStatuses((prev) => ({
          ...prev,
          [id]: validating ? { kind: "validating" } : { kind: "downloading", downloaded, total },
        }));
      }),
      onModelDownloadDone(({ id, path }) => {
        setStatuses((prev) => ({ ...prev, [id]: { kind: "installed", path } }));
        patchSetting("localModelPath", path);
      }),
      onModelDownloadError(({ id, message }) => {
        setStatuses((prev) => ({ ...prev, [id]: { kind: "error", message } }));
      }),
      onModelDownloadCancelled((id) => {
        setStatuses((prev) => ({ ...prev, [id]: { kind: "idle" } }));
      }),
    ]).then((us) => {
      if (!mounted) us.forEach((u) => u());
      else unlisteners.push(...us);
    });
    return () => {
      mounted = false;
      unlisteners.forEach((u) => u());
    };
  }, [patchSetting]);

  const handleDownload = async (modelId: string, customDir = false) => {
    try {
      let dir: string | null = null;
      if (customDir) {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const picked = await open({ directory: true, title: "Choose folder to save model" });
        if (!picked || Array.isArray(picked)) return;
        dir = picked;
      } else {
        const { appDataDir, join } = await import("@tauri-apps/api/path");
        const base = await appDataDir();
        dir = await join(base, "models");
      }
      await downloadModel(modelId, dir);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleCancel = async (modelId: string) => {
    try {
      await cancelDownload(modelId);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      {/* Header */}
      <div className="flex items-end justify-between gap-[var(--space-4)]">
        <div className="flex flex-col gap-[var(--space-1)]">
          <span
            className="font-[var(--font-mono)] uppercase tracking-[0.16em] text-[10px] text-[var(--text-tertiary)]"
            style={{ lineHeight: 1 }}
          >
            On-device transcription
          </span>
          <h1
            className="text-[24px] font-medium text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-sans)", lineHeight: 1.2, letterSpacing: "-0.01em" }}
          >
            Models
          </h1>
        </div>
        <p className="text-[11px] text-[var(--text-tertiary)] max-w-[280px] text-right hidden sm:block">
          Download a Whisper model to transcribe locally. Larger models are more accurate but slower.
        </p>
      </div>

      <Section eyebrow="Manifest" title="Available models" flush>
        <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--border-hairline)] overflow-hidden">
          {manifest.length === 0 && (
            <div className="px-[var(--space-5)] py-[var(--space-6)] text-[12px] text-[var(--text-tertiary)] font-[var(--font-mono)]">
              Loading manifest...
            </div>
          )}
          {manifest.map((m, i) => {
            const status: ModelStatus = statuses[m.id] ?? { kind: "idle" };
            const isActive =
              status.kind === "installed" && settings.localModelPath === status.path;
            const last = i === manifest.length - 1;
            return (
              <ModelRow
                key={m.id}
                model={m}
                status={status}
                active={isActive}
                divider={!last}
                onDownload={() => handleDownload(m.id)}
                onPickFolder={() => handleDownload(m.id, true)}
                onCancel={() => handleCancel(m.id)}
                onUse={() =>
                  status.kind === "installed" && patchSetting("localModelPath", status.path)
                }
              />
            );
          })}
        </div>
      </Section>

      {settings.localModelPath && (
        <Section eyebrow="Active" title="Current model" flush>
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-sunken)] px-[var(--space-5)] py-[var(--space-4)]">
            <p className="text-[10px] uppercase tracking-[0.16em] font-[var(--font-mono)] text-[var(--text-tertiary)] mb-[var(--space-2)]">
              Path
            </p>
            <p
              className="font-[var(--font-mono)] text-[12px] text-[var(--text-primary)] break-all"
              title={settings.localModelPath}
            >
              {settings.localModelPath}
            </p>
          </div>
        </Section>
      )}
    </div>
  );
}

function ModelRow({
  model,
  status,
  active,
  divider,
  onDownload,
  onPickFolder,
  onCancel,
  onUse,
}: {
  model: ModelManifestEntry;
  status: ModelStatus;
  active: boolean;
  divider: boolean;
  onDownload: () => void;
  onPickFolder: () => void;
  onCancel: () => void;
  onUse: () => void;
}) {
  const sizeText = formatBytes(model.sizeBytes);

  return (
    <div
      className={`relative px-[var(--space-5)] py-[var(--space-4)] flex items-center gap-[var(--space-4)] transition-colors duration-150 ${
        divider ? "border-b border-[var(--border-hairline)]" : ""
      } ${active ? "bg-[var(--bg-sunken)]" : ""}`}
    >
      {/* Active indicator: full block on the inner left, not a side stripe */}
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-6 rounded-r-[var(--radius-sm)]"
          style={{ background: "var(--accent)" }}
        />
      )}

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-[var(--space-3)]">
          <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">
            {model.name}
          </span>
          <span className="text-[10px] font-[var(--font-mono)] text-[var(--text-tertiary)] shrink-0">
            {sizeText}
          </span>
          {active && (
            <span
              className="text-[10px] font-[var(--font-mono)] uppercase tracking-[0.14em]"
              style={{ color: "var(--accent)" }}
            >
              active
            </span>
          )}
        </div>

        {status.kind === "downloading" && (
          <div className="mt-[var(--space-2)] flex items-center gap-[var(--space-3)]">
            <span className="relative flex-1 h-[2px] rounded-[var(--radius-full)] bg-[var(--border-hairline)] overflow-hidden">
              <span
                className="absolute inset-y-0 left-0 bg-[var(--accent)] transition-[width] duration-150"
                style={{ width: `${(status.downloaded / status.total) * 100}%` }}
              />
            </span>
            <span className="font-[var(--font-mono)] text-[10px] text-[var(--text-tertiary)] tabular-nums shrink-0">
              {Math.round((status.downloaded / status.total) * 100)}% · {formatBytes(status.downloaded)}
            </span>
          </div>
        )}
        {status.kind === "validating" && (
          <p className="mt-[var(--space-2)] text-[10px] font-[var(--font-mono)] text-[var(--text-tertiary)] inline-flex items-center gap-[6px]">
            <Loader2 size={10} strokeWidth={1.6} className="animate-spin" />
            Validating checksum
          </p>
        )}
        {status.kind === "error" && (
          <p
            role="alert"
            className="mt-[var(--space-2)] text-[10px] font-[var(--font-mono)] text-[var(--color-error)] truncate"
            title={status.message}
          >
            {status.message}
          </p>
        )}
        {status.kind === "installed" && !active && (
          <p
            className="mt-[var(--space-2)] text-[10px] font-[var(--font-mono)] text-[var(--text-tertiary)] truncate"
            title={status.path}
          >
            installed: {status.path.split(/[\\/]/).slice(-2).join("/")}
          </p>
        )}
      </div>

      {/* Action */}
      <div className="shrink-0 flex items-center gap-[var(--space-2)]">
        {(status.kind === "idle" || status.kind === "error") && (
          <>
            <Button onClick={onDownload} size="sm" variant="default">
              <Download size={12} strokeWidth={1.6} className="mr-[6px]" />
              {status.kind === "error" ? "Retry" : "Download"}
            </Button>
            <button
              onClick={onPickFolder}
              title="Choose a custom folder"
              aria-label="Choose a custom folder"
              className="w-7 h-7 inline-flex items-center justify-center rounded-[var(--radius-md)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-raised)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <FolderOpen size={13} strokeWidth={1.6} />
            </button>
          </>
        )}
        {status.kind === "downloading" && (
          <Button onClick={onCancel} size="sm" variant="ghost">
            <X size={12} strokeWidth={1.6} className="mr-[6px]" />
            Cancel
          </Button>
        )}
        {status.kind === "validating" && (
          <span className="text-[10px] font-[var(--font-mono)] text-[var(--text-tertiary)]">
            wait
          </span>
        )}
        {status.kind === "installed" && (
          active ? (
            <span className="inline-flex items-center gap-[6px] text-[11px] font-[var(--font-mono)] text-[var(--accent)] px-[var(--space-2)]">
              <Check size={12} strokeWidth={1.8} />
              In use
            </span>
          ) : (
            <Button onClick={onUse} size="sm" variant="ghost">
              Use
            </Button>
          )
        )}
      </div>
    </div>
  );
}
