import { useEffect, useRef } from "react";
import { onMicLevel } from "../lib/events";

interface MicMeterProps {
  active: boolean;
  height?: number;
  bars?: number;
  className?: string;
}

function toVisualLevel(level: number) {
  const noiseFloor = 0.01;
  const gain = 18;
  return Math.max(0, Math.min(1, (level - noiseFloor) * gain));
}

export function MicMeter({ active, height = 36, bars = 24, className = "" }: MicMeterProps) {
  const rafRef = useRef<number | null>(null);
  const barRefs = useRef<HTMLDivElement[]>([]);
  const levelRef = useRef<number>(0);
  const smoothedRef = useRef<number>(0);

  // Subscribe to backend mic-level events while active.
  useEffect(() => {
    if (!active) {
      levelRef.current = 0;
      return;
    }
    let unlisten: (() => void) | undefined;
    onMicLevel((level) => {
      levelRef.current = level;
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
      levelRef.current = 0;
    };
  }, [active]);

  // rAF loop — runs only while active.
  useEffect(() => {
    if (!active) {
      barRefs.current.forEach((b) => {
        if (b) b.style.transform = "scaleY(0.08)";
      });
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const tick = () => {
      // Raw RMS speech is tiny (~0.01-0.05), so map it to a visible range.
      const target = toVisualLevel(levelRef.current);
      smoothedRef.current += (target - smoothedRef.current) * 0.25;
      const base = smoothedRef.current;

      const els = barRefs.current;
      for (let i = 0; i < els.length; i++) {
        const el = els[i];
        if (!el) continue;
        // Per-bar phase offset gives a waveform shape rather than a flat bar.
        const phase = i * 0.42;
        const center = 1 - Math.abs(i / (els.length - 1) - 0.5) * 1.4;
        const jitter = 0.85 + 0.15 * Math.sin(Date.now() / 80 + phase);
        const scaled = Math.max(0.06, Math.min(1, base * Math.max(0.2, center) * jitter));
        el.style.transform = `scaleY(${scaled.toFixed(3)})`;
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
  }, [active]);

  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={`flex items-center justify-center gap-[3px] ${className}`}
      style={{ height }}
    >
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          ref={(el) => {
            if (el) barRefs.current[i] = el;
            else delete barRefs.current[i];
          }}
          style={{
            width: 2,
            height: "100%",
            background: active ? "var(--accent)" : "var(--text-ghost)",
            borderRadius: "var(--radius-sm)",
            transformOrigin: "center",
            transform: "scaleY(0.08)",
            transition: active
              ? "background 200ms var(--ease-out-quart)"
              : "transform 300ms var(--ease-out-quart), background 200ms var(--ease-out-quart)",
            willChange: "transform",
          }}
        />
      ))}
    </div>
  );
}
