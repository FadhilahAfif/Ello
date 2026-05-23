import { useRef, useEffect } from "react";
import type { OverlayState } from "../shared/useOverlayState";
import { toVisual } from "../shared/overlayUtils";

const BARS = 12;

interface Props {
  state: OverlayState;
  levelRef: React.MutableRefObject<number>;
  smoothedRef: React.MutableRefObject<number>;
  accent: string;
}

export function PillOverlay({ state, levelRef, smoothedRef, accent }: Props) {
  const barRefs = useRef<(HTMLDivElement | null)[]>(Array(BARS).fill(null));
  const rafRef  = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      if (state === "recording") {
        const target = toVisual(levelRef.current);
        smoothedRef.current += (target - smoothedRef.current) * 0.25;
        const base = smoothedRef.current;
        for (let i = 0; i < BARS; i++) {
          const el = barRefs.current[i];
          if (!el) continue;
          const phase  = i * 0.42;
          const center = 1 - Math.abs(i / (BARS - 1) - 0.5) * 1.4;
          const jitter = 0.85 + 0.15 * Math.sin(Date.now() / 80 + phase);
          const scaled = Math.max(0.08, Math.min(1, base * Math.max(0.2, center) * jitter));
          el.style.transform = `scaleY(${scaled.toFixed(3)})`;
        }
      } else {
        smoothedRef.current *= 0.85;
        for (let i = 0; i < BARS; i++) {
          const el = barRefs.current[i];
          if (el) el.style.transform = `scaleY(${Math.max(0.08, smoothedRef.current).toFixed(3)})`;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [state, levelRef, smoothedRef]);

  const isRecording    = state === "recording";
  const isTranscribing = state === "transcribing";

  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      background: "#1a1a18", border: "1px solid #2e2e2c",
      borderRadius: 9999, padding: "6px 14px 6px 10px",
      boxShadow: "0 2px 16px rgba(0,0,0,0.5)",
      animation: "overlay-slide-in 220ms cubic-bezier(0.4,0,0.2,1) both",
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: isRecording ? accent : "#555", flexShrink: 0,
        boxShadow: isRecording ? `0 0 6px ${accent}` : "none",
        animation: isRecording ? "dot-pulse 1.4s ease-in-out infinite" : "none",
      }} />
      {isRecording && (
        <div style={{ display: "flex", alignItems: "center", gap: 2, height: 18 }}>
          {Array.from({ length: BARS }).map((_, i) => (
            <div key={i} ref={el => { barRefs.current[i] = el; }} style={{
              width: 2.5, height: "100%", background: accent,
              borderRadius: 2, transformOrigin: "center",
              transform: "scaleY(0.08)", willChange: "transform", opacity: 0.9,
            }} />
          ))}
        </div>
      )}
      {isTranscribing && (
        <div style={{ width: 36, height: 2, background: "#2a2a2a", borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            width: "35%", height: "100%", background: "#555",
            borderRadius: 2, animation: "hairline-progress 1.4s ease-in-out infinite",
          }} />
        </div>
      )}
    </div>
  );
}
