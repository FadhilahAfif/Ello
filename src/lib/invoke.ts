import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, AudioDevice } from "../store/settings";

export interface ModelManifestEntry {
  id: string;
  name: string;
  filename: string;
  sizeBytes: number;
  sha1: string;
}

export interface ModelValidationResult {
  valid: boolean;
  error: string | null;
}

export type VocabularyKind = "exact" | "prefix" | "contains";

export interface VocabularyRule {
  id: number;
  term: string;
  replacement: string;
  caseSensitive: boolean;
  kind: VocabularyKind;
}

export interface VocabularyUpsert {
  id: number | null;
  term: string;
  replacement: string;
  caseSensitive: boolean;
  kind: VocabularyKind;
}

export interface HistoryItem {
  id: number;
  text: string;
  createdAt: string;
  mode: string;
  model: string;
  durationMs: number;
  wordCount: number;
}

export const getSettings = () => invoke<AppSettings>("get_settings");
export const saveSettings = (settings: AppSettings) => invoke<void>("save_settings", { settings });
export const getDevices = () => invoke<AudioDevice[]>("get_devices");
export const getModelManifest = () => invoke<ModelManifestEntry[]>("get_model_manifest");
export const downloadModel = (id: string, destDir: string) =>
  invoke<void>("download_model", { id, destDir });
export const cancelDownload = (id: string) => invoke<void>("cancel_download", { id });
export const startRecording = () => invoke<void>("start_recording");
export const stopRecording = () => invoke<void>("stop_recording");
export const validateModel = (id: string, path: string) =>
  invoke<ModelValidationResult>("validate_model", { id, path });
export const checkInstalledModels = () =>
  invoke<Record<string, string>>("check_installed_models");
export const vocabularyList = () => invoke<VocabularyRule[]>("vocabulary_list");
export const vocabularyUpsert = (rule: VocabularyUpsert) =>
  invoke<VocabularyRule>("vocabulary_upsert", { rule });
export const vocabularyDelete = (id: number) => invoke<void>("vocabulary_delete", { id });
export const vocabularyImportCsv = (csv: string) =>
  invoke<number>("vocabulary_import_csv", { csv });
export const historyList = (query: string | null, limit: number, offset: number) =>
  invoke<HistoryItem[]>("history_list", { query, limit, offset });
export const polishTest = (text: string) => invoke<string>("polish_test", { text });
