import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";

type OverlayState = "hidden" | "recording" | "transcribing";

const BARS = 14;

function toVisualLevel(level: number) {
  const noiseFloor = 0.01;
  const gain = 18;
  return Math.max(0, Math.min(1, (level - noiseFloor) * gain));
}

export function OverlayApp() {
  const [state, setState] = useState<OverlayState>("hidden");
  const stateRef = useRef<OverlayState>("hidden");
  const levelRef = useRef<number>(0);
  const smoothedRef = useRef<number>(0);
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);

  // Keep stateRef in sync so the rAF loop can read it without a closure stale value.
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Subscribe to backend events.
  useEffect(() => {
    const unlisteners: Array<() => void> = [];

    listen("recording-started", () => setState("recording")).then((u) =>
      unlisteners.push(u)
    );
    listen("recording-stopped", () => setState("transcribing")).then((u) =>
      unlisteners.push(u)
    );
    listen("transcription-done", () => setState("hidden")).then((u) =>
      unlisteners.push(u)
    );
    listen<number>("mic-level", (e) => {
      levelRef.current = e.payload;
    }).then((u) => unlisteners.push(u));

    return () => unlisteners.forEach((u) => u());
  }, []);

  // Single persistent rAF loop — runs always, animates bars only when recording.
  useEffect(() => {
    const tick = () => {
      if (stateRef.current === "recording") {
        const target = toVisualLevel(levelRef.current);
        smoothedRef.current += (target - smoothedRef.current) * 0.25;
        const base = smoothedRef.current;
        for (let i = 0; i < BARS; i++) {
          const el = barRefs.current[i];
          if (!el) continue;
          const phase = i * 0.42;
          const center = 1 - Math.abs(i / (BARS - 1) - 0.5) * 1.4;
          const jitter = 0.85 + 0.15 * Math.sin(Date.now() / 80 + phase);
          const scaled = Math.max(0.08, Math.min(1, base * Math.max(0.2, center) * jitter));
          el.style.transform = `scaleY(${scaled.toFixed(3)})`;
        }
      } else {
        // Settle bars to baseline when not recording.
        smoothedRef.current *= 0.85;
        for (let i = 0; i < BARS; i++) {
          const el = barRefs.current[i];
          if (el) el.style.transform = `scaleY(${Math.max(0.08, smoothedRef.current).toFixed(3)})`;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  const isRecording = state === "recording";
  const isTranscribing = state === "transcribing";
  const visible = state !== "hidden";

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          background: "#141414",
          border: "1px solid #2a2a2a",
          borderTop: `2px solid ${isRecording ? "#e8a020" : "#555"}`,
          borderRadius: "0 0 12px 12px",
          padding: "8px 18px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
          animation: "overlay-slide-in 220ms cubic-bezier(0.4,0,0.2,1) both",
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: isRecording ? "#e8a020" : "#666",
            display: "inline-block",
            boxShadow: isRecording ? "0 0 6px #e8a020" : "none",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.12em",
            color: isRecording ? "#e8a020" : "#888",
            minWidth: 96,
          }}
        >
          {isRecording ? "RECORDING" : "TRANSCRIBING"}
        </span>

        {isRecording && (
          <div style={{ display: "flex", alignItems: "center", gap: 2, height: 16 }}>
            {Array.from({ length: BARS }).map((_, i) => (
              <div
                key={i}
                ref={(el) => { barRefs.current[i] = el; }}
                style={{
                  width: 2,
                  height: "100%",
                  background: "#e8a020",
                  borderRadius: 2,
                  transformOrigin: "center",
                  transform: "scaleY(0.08)",
                  willChange: "transform",
                }}
              />
            ))}
          </div>
        )}

        {isTranscribing && (
          <div
            style={{
              width: 48,
              height: 2,
              background: "#2a2a2a",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "35%",
                height: "100%",
                background: "#666",
                borderRadius: 2,
                animation: "hairline-progress 1.4s ease-in-out infinite",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
