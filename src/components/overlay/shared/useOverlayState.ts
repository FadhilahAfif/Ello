import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";

export type OverlayState = "hidden" | "recording" | "transcribing";

export function useOverlayState() {
  const [state, setState] = useState<OverlayState>("hidden");
  const stateRef = useRef<OverlayState>("hidden");

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    const register = (promise: Promise<() => void>) => {
      promise.then(u => {
        if (cancelled) { u(); } else { unsubs.push(u); }
      });
    };

    register(listen("recording-started",  () => setState("recording")));
    register(listen("recording-stopped",  () => setState("transcribing")));
    register(listen("transcription-done", () => setState("hidden")));

    return () => { cancelled = true; unsubs.forEach(u => u()); };
  }, []);

  return { state, stateRef };
}
