import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, AudioDevice, ModelInfo } from "../store/settings";

export const getSettings = () => invoke<AppSettings>("get_settings");
export const saveSettings = (settings: AppSettings) => invoke<void>("save_settings", { settings });
export const getDevices = () => invoke<AudioDevice[]>("get_devices");
export const getModelManifest = () => invoke<ModelInfo[]>("get_model_manifest");
export const downloadModel = (id: string, destDir: string) =>
  invoke<void>("download_model", { id, destDir });
export const cancelDownload = (id: string) => invoke<void>("cancel_download", { id });
