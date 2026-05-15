import { useState, useEffect } from "react";
import { useSettingsStore } from "../store/settings";
import type { ModelStatus } from "../store/settings";
import { getModelManifest, downloadModel, cancelDownload } from "../lib/invoke";
import type { ModelManifestEntry } from "../lib/invoke";
import {
  onModelDownloadProgress, onModelDownloadDone,
  onModelDownloadError, onModelDownloadCancelled,
} from "../lib/events";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Progress } from "../components/ui/Progress";

export function Models() {
  const { settings, patchSetting, setError } = useSettingsStore();
  const [manifest, setManifest] = useState<ModelManifestEntry[]>([]);
  const [modelStatuses, setModelStatuses] = useState<Record<string, ModelStatus>>({});
  const [selectedModelId, setSelectedModelId] = useState<string>("small");

  useEffect(() => {
    getModelManifest().then(setManifest).catch(console.error);
  }, []);

  useEffect(() => {
    let mounted = true;
    const unlisteners: Array<() => void> = [];

    Promise.all([
      onModelDownloadProgress(({ id, downloaded, total, validating }) => {
        setModelStatuses((prev) => ({
          ...prev,
          [id]: validating ? { kind: "validating" } : { kind: "downloading", downloaded, total },
        }));
      }),
      onModelDownloadDone(({ id, path }) => {
        setModelStatuses((prev) => ({ ...prev, [id]: { kind: "installed", path } }));
        patchSetting("localModelPath", path);
      }),
      onModelDownloadError(({ id, message }) => {
        setModelStatuses((prev) => ({ ...prev, [id]: { kind: "error", message } }));
      }),
      onModelDownloadCancelled((id) => {
        setModelStatuses((prev) => ({ ...prev, [id]: { kind: "idle" } }));
      }),
    ]).then((us) => {
      if (!mounted) us.forEach((u) => u());
      else unlisteners.push(...us);
    });

    return () => { mounted = false; unlisteners.forEach((u) => u()); };
  }, []);

  const handleDownload = async (modelId: string) => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const dir = await open({ directory: true, title: "Choose folder to save model" });
      if (!dir || Array.isArray(dir)) return;
      await downloadModel(modelId, dir);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleCancelDownload = async (modelId: string) => {
    try {
      await cancelDownload(modelId);
    } catch (e) {
      setError(String(e));
    }
  };

  const st: ModelStatus = modelStatuses[selectedModelId] ?? { kind: "idle" };
  const selectedModel = manifest.find((m) => m.id === selectedModelId);

  return (
    <div className="p-[var(--space-6)] flex flex-col gap-[var(--space-4)] max-w-xl">
      <h1 className="text-[20px] font-medium text-[var(--text-primary)]">Models</h1>

      <Card>
        <p className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-[0.14em] mb-[var(--space-3)]">Select model</p>
        <Select
          value={selectedModelId}
          onChange={(e) => setSelectedModelId(e.target.value)}
        >
          {manifest.map((m) => {
            const s: ModelStatus = modelStatuses[m.id] ?? { kind: "idle" };
            const suffix = s.kind === "installed" ? " ✓" : s.kind === "downloading" || s.kind === "validating" ? " ↓" : "";
            return (
              <option key={m.id} value={m.id}>
                {m.name} — {(m.sizeBytes / 1_073_741_824).toFixed(1)} GB{suffix}
              </option>
            );
          })}
        </Select>

        <div className="mt-[var(--space-3)]">
          {(st.kind === "idle" || st.kind === "error") && (
            <div className="flex flex-col gap-[var(--space-2)]">
              {st.kind === "error" && (
                <p role="alert" className="text-[11px] text-[var(--color-error)]">{st.message}</p>
              )}
              <Button onClick={() => handleDownload(selectedModelId)} size="sm">
                {st.kind === "error" ? "Retry Download" : "Download"}
              </Button>
            </div>
          )}

          {st.kind === "downloading" && (
            <div className="flex flex-col gap-[var(--space-2)]">
              <Progress
                value={st.downloaded}
                max={st.total}
                label={`Downloading ${selectedModel?.name ?? selectedModelId}`}
              />
              <div className="flex justify-between text-[11px] text-[var(--text-tertiary)] font-mono">
                <span>{Math.round((st.downloaded / st.total) * 100)}%</span>
                <span>{(st.downloaded / 1_048_576).toFixed(0)} / {(st.total / 1_048_576).toFixed(0)} MB</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleCancelDownload(selectedModelId)}>
                Cancel
              </Button>
            </div>
          )}

          {st.kind === "validating" && (
            <p className="text-[11px] text-[var(--text-tertiary)]">Validating checksum…</p>
          )}

          {st.kind === "installed" && (
            <div className="flex flex-col gap-[var(--space-2)]">
              <p className="text-[11px] text-[var(--text-secondary)] font-mono truncate" title={st.path}>
                ✓ {st.path.split(/[\\/]/).pop()}
              </p>
              {settings.localModelPath !== st.path ? (
                <Button size="sm" onClick={() => patchSetting("localModelPath", st.path)}>
                  Use this model
                </Button>
              ) : (
                <span className="text-[11px] text-[var(--accent)] font-mono">Active</span>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
