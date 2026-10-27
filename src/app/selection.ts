/** Pure helpers for selecting crew with the mouse (the controller feeds them screen points and ids). */

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Pt {
  x: number;
  y: number;
}

/** The rectangle between two drag corners, with x0 <= x1 and y0 <= y1. */
export function normRect(a: Pt, b: Pt): Rect {
  return { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
}

/** The ids whose point lies inside the rectangle (edges included), in the order given. */
export function idsInRect(rect: Rect, points: readonly (Pt & { id: number })[]): number[] {
  return points.filter((p) => p.x >= rect.x0 && p.x <= rect.x1 && p.y >= rect.y0 && p.y <= rect.y1).map((p) => p.id);
}

/** A click on one crew member: plain selects just them; with shift it adds them, or takes them out again if already in. */
export function clickSelection(current: readonly number[], id: number, shift: boolean): number[] {
  if (!shift) return [id];
  return current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
}

/** A box drag: plain replaces the selection with the hits; with shift the hits are added to it. */
export function boxSelection(current: readonly number[], hits: readonly number[], shift: boolean): number[] {
  if (!shift) return [...hits];
  return [...current, ...hits.filter((h) => !current.includes(h))];
}
