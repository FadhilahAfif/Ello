import type { OverlayState } from "../shared/useOverlayState";

interface Props { state: OverlayState; accent: string; }

export function DotOverlay({ state, accent }: Props) {
  const isRecording = state === "recording";
  return (
    <div style={{
      width: 12, height: 12, borderRadius: "50%",
      background: isRecording ? accent : "#555",
      boxShadow: isRecording ? `0 0 8px ${accent}` : "none",
      animation: isRecording
        ? "dot-pulse 1.4s ease-in-out infinite"
        : "dot-breath 2.4s ease-in-out infinite",
    }} />
  );
}
