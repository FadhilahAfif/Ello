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

export interface VocabularyRule {
  id: number | null;
  term: string;
  replacement: string;
  caseSensitive: boolean;
  kind: "exactWord" | "prefix" | "contains";
}

export interface PolishTestResult {
  before: string;
  after: string;
  error: string | null;
}

export const vocabularyList = () => invoke<VocabularyRule[]>("vocabulary_list");
export const vocabularyUpsert = (rule: VocabularyRule) =>
  invoke<VocabularyRule>("vocabulary_upsert", { rule });
export const vocabularyDelete = (id: number) =>
  invoke<void>("vocabulary_delete", { id });
export const vocabularyImportCsv = (csvText: string) =>
  invoke<number>("vocabulary_import_csv", { csvText });
export const polishTest = () => invoke<PolishTestResult>("polish_test");
