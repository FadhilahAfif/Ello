export function toVisual(level: number): number {
  return Math.max(0, Math.min(1, (level - 0.01) * 18));
}
