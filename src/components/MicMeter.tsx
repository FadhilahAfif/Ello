import { useEffect, useRef } from "react";

interface MicMeterProps {
  /** Whether the meter is active. When false, meter quiets to baseline. */
  active: boolean;
  /** Visual height in px. */
  height?: number;
  /** Number of bars rendered. Bars give a more "voice waveform" feel than a single bar. */
  bars?: number;
  className?: string;
}

/**
 * Synthetic-envelope mic meter.
 *
 * Phase 5: drives bars from a layered sine envelope when `active` is true.
 * Phase 7: this same component will swap the data source to backend `mic-level`
 * events without changing the API.
 */
export function MicMeter({ active, height = 36, bars = 24, className = "" }: MicMeterProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const barRefs = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    if (!active) {
      // Settle to a low baseline.
      barRefs.current.forEach((b) => {
        if (b) b.style.transform = "scaleY(0.08)";
      });
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    startRef.current = performance.now();

    const tick = (now: number) => {
      const t = (now - startRef.current) / 1000;
      const els = barRefs.current;
      for (let i = 0; i < els.length; i++) {
        const el = els[i];
        if (!el) continue;
        // Layered sines + per-bar phase create an irregular envelope that
        // reads like speech, not a metronome.
        const phase = i * 0.42;
        const slow = 0.5 + 0.5 * Math.sin(t * 1.6 + phase);
        const fast = 0.5 + 0.5 * Math.sin(t * 5.7 + phase * 1.7);
        const flicker = 0.5 + 0.5 * Math.sin(t * 13.0 + phase * 0.31);
        const env = slow * 0.55 + fast * 0.3 + flicker * 0.15;

        // Center bias so middle bars are taller (mouth-shape feel).
        const center = 1 - Math.abs(i / (els.length - 1) - 0.5) * 1.4;
        const scaled = Math.max(0.06, Math.min(1, env * Math.max(0.2, center)));
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
      ref={containerRef}
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
          }}
          style={{
            width: 2,
            height: "100%",
            background: active ? "var(--accent)" : "var(--text-ghost)",
            borderRadius: "var(--radius-sm)",
            transformOrigin: "center",
            transform: "scaleY(0.08)",
            transition: active ? "background 200ms var(--ease-out-quart)" : "transform 300ms var(--ease-out-quart), background 200ms var(--ease-out-quart)",
            willChange: "transform",
          }}
        />
      ))}
    </div>
  );
}
