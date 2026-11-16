/**
 * Player-built windows in a layout (#516): each is a straight run of wall tiles, saved as its lower-coordinate end, axis and size in
 * design coordinates. The game's own rules (`windowRunError`, `windowPlan`) decide where one may go; this file holds the edits.
 */
import { windowRun, type WindowAxis } from '../../src/sim';
import type { Layout, Tile } from './layout';

export interface LayoutWindow { x: number; y: number; axis: WindowAxis; size: number }

export const windowsOf = (l: Layout): readonly LayoutWindow[] => l.windows ?? [];
export const windowTiles = (w: LayoutWindow): Tile[] => windowRun(w.x, w.y, w.axis, w.size).map((t): Tile => [t.x, t.y]);
export const windowTilesOf = (l: Layout): Tile[] => windowsOf(l).flatMap(windowTiles);

/** The index of the window covering a tile, or -1. */
export const windowIndexAt = (l: Layout, x: number, y: number): number => windowsOf(l).findIndex((w) => windowTiles(w).some(([tx, ty]) => tx === x && ty === y));

const same = (a: LayoutWindow, b: LayoutWindow): boolean => a.x === b.x && a.y === b.y && a.axis === b.axis && a.size === b.size;
const withWindows = (l: Layout, windows: LayoutWindow[]): Layout => {
  const next: Layout = { ...l };
  delete next.windows;
  return windows.length ? { ...next, windows } : next;
};

/** Add a window (a run already checked against the game's rules); the same one twice changes nothing. */
export function addWindow(l: Layout, w: LayoutWindow): Layout {
  return windowsOf(l).some((o) => same(o, w)) ? l : withWindows(l, [...windowsOf(l), { ...w }]);
}
/** Remove the window covering a tile. */
export function removeWindowAt(l: Layout, x: number, y: number): Layout {
  const i = windowIndexAt(l, x, y);
  return i < 0 ? l : withWindows(l, windowsOf(l).filter((_, k) => k !== i));
}
/** Keep the windows whose tiles are all still what they were (a wall) after an edit from `before` to `after` cells: painting over one drops it. */
export function keepWindows(l: Layout, before: readonly string[]): Layout {
  const ws = windowsOf(l);
  if (!ws.length) return l;
  const keep = ws.filter((w) => windowTiles(w).every(([x, y]) => l.cells[y]?.[x] === '#' && before[y]?.[x] === '#'));
  return keep.length === ws.length ? l : withWindows(l, keep);
}
