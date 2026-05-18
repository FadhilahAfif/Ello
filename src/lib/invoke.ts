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
