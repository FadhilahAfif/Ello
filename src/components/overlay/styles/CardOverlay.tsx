import { useRef, useEffect } from "react";
import type { OverlayState } from "../shared/useOverlayState";
import type { OverlayPosition } from "../../../store/settings";
import { toVisual } from "../shared/overlayUtils";

const BARS = 14;

interface Props {
  state: OverlayState;
  levelRef: React.MutableRefObject<number>;
  smoothedRef: React.MutableRefObject<number>;
  accent: string;
  position: OverlayPosition;
}

export function CardOverlay({ state, levelRef, smoothedRef, accent, position }: Props) {
  const barRefs = useRef<(HTMLDivElement | null)[]>(Array(BARS).fill(null));
  const rafRef  = useRef<number | null>(null);
  const isBottom = position.startsWith("bottom");

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

  const borderStyle = isBottom
    ? { border: "1px solid #2a2a2a", borderBottom: `2px solid ${accent}`, borderRadius: "10px 10px 0 0" }
    : { border: "1px solid #2a2a2a", borderTop:    `2px solid ${accent}`, borderRadius: "0 0 10px 10px" };

  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      background: "#141414", ...borderStyle,
      padding: "8px 18px",
      boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
      animation: isBottom
        ? "overlay-slide-in-bottom 220ms cubic-bezier(0.4,0,0.2,1) both"
        : "overlay-slide-in 220ms cubic-bezier(0.4,0,0.2,1) both",
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: isRecording ? accent : "#666",
        display: "inline-block", flexShrink: 0,
        boxShadow: isRecording ? `0 0 6px ${accent}` : "none",
      }} />
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 11,
        letterSpacing: "0.12em",
        color: isRecording ? accent : "#888",
        minWidth: 96,
      }}>
        {state === "recording" ? "RECORDING" : "TRANSCRIBING"}
      </span>
      {isRecording && (
        <div style={{ display: "flex", alignItems: "center", gap: 2, height: 16 }}>
          {Array.from({ length: BARS }).map((_, i) => (
            <div key={i} ref={el => { barRefs.current[i] = el; }} style={{
              width: 2, height: "100%", background: accent,
              borderRadius: 2, transformOrigin: "center",
              transform: "scaleY(0.08)", willChange: "transform",
            }} />
          ))}
        </div>
      )}
      {isTranscribing && (
        <div style={{ width: 48, height: 2, background: "#2a2a2a", borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            width: "35%", height: "100%", background: "#666",
            borderRadius: 2, animation: "hairline-progress 1.4s ease-in-out infinite",
          }} />
        </div>
      )}
    </div>
  );
}
