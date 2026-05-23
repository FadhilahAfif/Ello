import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getSettings } from "../../lib/invoke";
import { useOverlayState } from "./shared/useOverlayState";
import { useMicLevel } from "./shared/useMicLevel";
import { CardOverlay } from "./styles/CardOverlay";
import { DotOverlay }  from "./styles/DotOverlay";
import { PillOverlay } from "./styles/PillOverlay";
import type { OverlaySettings, OverlayColor } from "../../store/settings";

const COLOR_MAP: Record<OverlayColor, string> = {
  accent: "#e8a020",  // semantic alias — resolves to amber
  amber:  "#e8a020",
  cyan:   "#22d3ee",
  green:  "#34d399",
  white:  "#f0efeb",
};

const DEFAULT_OVERLAY: OverlaySettings = {
  style:    "card",
  color:    "accent",
  position: "topCenter",
};

export function OverlayApp() {
  const [overlay, setOverlay] = useState<OverlaySettings>(DEFAULT_OVERLAY);
  const { state }             = useOverlayState();
  const { levelRef, smoothedRef } = useMicLevel();

  useEffect(() => {
    getSettings().then(s => setOverlay(s.overlay ?? DEFAULT_OVERLAY)).catch(() => {
      console.warn("[OverlayApp] failed to load settings, using defaults");
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;

    listen<OverlaySettings>("overlay-settings-changed", e => {
      setOverlay(e.payload);
    }).then(u => {
      if (cancelled) u();
      else unsub = u;
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const accent  = COLOR_MAP[overlay.color] ?? COLOR_MAP.accent;
  const visible = state !== "hidden";

  if (!visible) return null;

  const isBottom  = overlay.position.startsWith("bottom");
  const isCenter  = overlay.position.endsWith("Center");
  const isLeft    = overlay.position.endsWith("Left");

  const wrapStyle: React.CSSProperties = {
    position: "fixed",
    top:    isBottom ? undefined : 0,
    bottom: isBottom ? 0 : undefined,
    left: 0, right: 0,
    display: "flex",
    justifyContent: isCenter ? "center" : isLeft ? "flex-start" : "flex-end",
    pointerEvents: "none",
    padding: overlay.style === "card" ? 0 : 12,
  };

  return (
    <div style={wrapStyle}>
      {overlay.style === "card" && (
        <CardOverlay
          state={state} levelRef={levelRef} smoothedRef={smoothedRef}
          accent={accent} position={overlay.position}
        />
      )}
      {overlay.style === "dot" && (
        <DotOverlay state={state} accent={accent} />
      )}
      {overlay.style === "pill" && (
        <PillOverlay
          state={state} levelRef={levelRef} smoothedRef={smoothedRef}
          accent={accent}
        />
      )}
    </div>
  );
}
