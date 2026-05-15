import { listen } from "@tauri-apps/api/event";

export const onRecordingStarted = (cb: () => void) =>
  listen("recording-started", () => cb());

export const onRecordingStopped = (cb: () => void) =>
  listen("recording-stopped", () => cb());

export const onTranscriptionStarted = (cb: () => void) =>
  listen("transcription-started", () => cb());

export const onTranscriptionDone = (cb: (text: string) => void) =>
  listen<{ text: string }>("transcription-done", (e) => cb(e.payload.text));

export const onAppError = (cb: (message: string) => void) =>
  listen<{ message: string }>("app-error", (e) => cb(e.payload.message));

export const onModelDownloadProgress = (
  cb: (payload: { id: string; downloaded: number; total: number; validating?: boolean }) => void
) => listen<{ id: string; downloaded: number; total: number; validating?: boolean }>(
  "model-download-progress", (e) => cb(e.payload)
);

export const onModelDownloadDone = (cb: (payload: { id: string; path: string }) => void) =>
  listen<{ id: string; path: string }>("model-download-done", (e) => cb(e.payload));

export const onModelDownloadError = (cb: (payload: { id: string; message: string }) => void) =>
  listen<{ id: string; message: string }>("model-download-error", (e) => cb(e.payload));

export const onModelDownloadCancelled = (cb: (id: string) => void) =>
  listen<{ id: string }>("model-download-cancelled", (e) => cb(e.payload.id));
