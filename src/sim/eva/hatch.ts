/** The point of the shuttle's hull-facing side (2.6 tiles from its centre toward the hull tile), in sector tiles: drifting crew start and end there, in view rather than under the sprite. */
export function hatchFace(frame: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } {
  const dx = to.x - frame.x;
  const dy = to.y - frame.y;
  const d = Math.hypot(dx, dy);
  const k = d > 0 ? Math.min(2.6, Math.max(0, d - 0.5)) / d : 0;
  return { x: frame.x + dx * k, y: frame.y + dy * k };
}
