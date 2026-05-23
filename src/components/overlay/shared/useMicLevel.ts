import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";

export function useMicLevel() {
  const levelRef    = useRef(0);
  const smoothedRef = useRef(0);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    listen<number>("mic-level", e => { levelRef.current = e.payload; })
      .then(u => { unsub = u; });
    return () => { unsub?.(); };
  }, []);

  return { levelRef, smoothedRef };
}
