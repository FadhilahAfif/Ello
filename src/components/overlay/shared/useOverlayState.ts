import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";

export type OverlayState = "hidden" | "recording" | "transcribing";

export function useOverlayState() {
  const [state, setState] = useState<OverlayState>("hidden");
  const stateRef = useRef<OverlayState>("hidden");

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    listen("recording-started",  () => setState("recording")).then(u => unsubs.push(u));
    listen("recording-stopped",  () => setState("transcribing")).then(u => unsubs.push(u));
    listen("transcription-done", () => setState("hidden")).then(u => unsubs.push(u));
    return () => unsubs.forEach(u => u());
  }, []);

  return { state, stateRef };
}
