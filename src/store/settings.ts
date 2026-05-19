import { create } from "zustand";

export type TranscriptionMode = "cloud" | "local";
export type HotkeyMode = "toggle" | "pushToTalk";
export type RecordingStatus = "idle" | "recording" | "transcribing";

export interface ModelInfo {
  id: string;
  name: string;
  filename: string;
  sizeBytes: number;
  sha1: string;
}

export type ModelStatus =
  | { kind: "idle" }
  | { kind: "downloading"; downloaded: number; total: number }
  | { kind: "validating" }
  | { kind: "installed"; path: string }
  | { kind: "error"; message: string };

export interface AiPolishSettings {
  enabled: boolean;
  model: string;
  prompt: string;
  minWordCount: number;
}

export interface AppSettings {
  schemaVersion: number;
  // Security: in-memory only — never log, serialize to UI, or pass as prop
  groqApiKey: string | null;
  cloudModel: string;
  transcriptionMode: TranscriptionMode;
  hotkeyMode: HotkeyMode;
  autostartEnabled: boolean;
  micDeviceId: string | null;
  localModelPath: string | null;
  hotkey: string;
  aiPolish: AiPolishSettings;
  historyEnabled: boolean;
  statsEnabled: boolean;
  onboardingComplete: boolean;
  lastSeenVersion: string | null;
  updateChannel: string;
  theme: string;
  accentColor: string;
}

export interface AudioDevice {
  id: string;
  name: string;
  isDefault: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: 2,
  groqApiKey: null,
  cloudModel: "whisper-large-v3-turbo",
  transcriptionMode: "cloud",
  hotkeyMode: "toggle",
  autostartEnabled: false,
  micDeviceId: null,
  localModelPath: null,
  hotkey: "Alt+Shift+D",
  aiPolish: {
    enabled: false,
    model: "llama-3.3-70b-versatile",
    prompt: "Remove filler words and fix grammar without changing meaning.",
    minWordCount: 10,
  },
  historyEnabled: true,
  statsEnabled: true,
  onboardingComplete: false,
  lastSeenVersion: null,
  updateChannel: "stable",
  theme: "dark",
  accentColor: "#7c5cff",
};

interface SettingsStore {
  settings: AppSettings;
  devices: AudioDevice[];
  status: RecordingStatus;
  lastTranscript: string | null;
  dirty: boolean;
  error: string | null;
  setSettings: (s: AppSettings) => void;
  setDevices: (d: AudioDevice[]) => void;
  patchSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  setStatus: (s: RecordingStatus) => void;
  setLastTranscript: (t: string | null) => void;
  resetSettings: () => void;
  setError: (e: string | null) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: DEFAULT_SETTINGS,
  devices: [],
  status: "idle",
  lastTranscript: null,
  dirty: false,
  error: null,
  setSettings: (s) => set({ settings: s, dirty: false }),
  setDevices: (d) => set({ devices: d }),
  patchSetting: (key, value) =>
    set((state) => ({ settings: { ...state.settings, [key]: value }, dirty: true, error: null })),
  setStatus: (s) => set({ status: s }),
  setLastTranscript: (t) => set({ lastTranscript: t }),
  resetSettings: () => set({ settings: DEFAULT_SETTINGS, dirty: false, error: null }),
  setError: (e) => set({ error: e }),
}));
