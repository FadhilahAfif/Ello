import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";

export function useMicLevel() {
  const levelRef    = useRef(0);
  const smoothedRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;
    listen<number>("mic-level", e => { levelRef.current = e.payload; })
      .then(u => { if (cancelled) { u(); } else { unsub = u; } });
    return () => { cancelled = true; unsub?.(); };
  }, []);

  return { levelRef, smoothedRef };
}
