import type { Tile } from './input';

/** What a rectangle drag does to the painted set. */
export type AreaMode = 'add' | 'erase';

/**
 * Rectangle painting of a tile set: drag a rectangle to add its tiles to the set, or (in 'erase' mode) take them out. The shipyard's planning view
 * uses it for the hull area; the construction pod will paint the same way. Pure bookkeeping: what the tiles mean, and whether they are allowed,
 * is up to the caller (the sim's plan check).
 */
export interface AreaPaint {
  /** The painted tiles, top to bottom, left to right. */
  tiles(): Tile[];
  mode(): AreaMode;
  setMode(mode: AreaMode): void;
  /** Replace the set (e.g. restore it), or empty it. */
  set(tiles: readonly Tile[]): void;
  clear(): void;
  /** Start a drag at a tile, move it, finish it (applies the rectangle; returns true when the set changed), or drop it. */
  begin(t: Tile): void;
  drag(t: Tile): void;
  end(): boolean;
  cancel(): void;
  /** The rectangle being dragged (empty when none), for the preview. */
  dragging(): Tile[];
}

const key = (t: Tile): string => `${t.x},${t.y}`;

/** The tiles of the rectangle with corners a and b (inclusive), top to bottom, left to right. */
export function rectTiles(a: Tile, b: Tile): Tile[] {
  const out: Tile[] = [];
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) out.push({ x, y });
  return out;
}

export function createAreaPaint(initial: AreaMode = 'add'): AreaPaint {
  const set = new Map<string, Tile>();
  let mode = initial;
  let from: Tile | null = null;
  let to: Tile | null = null;
  const sorted = (): Tile[] => [...set.values()].sort((a, b) => a.y - b.y || a.x - b.x);
  return {
    tiles: sorted,
    mode: () => mode,
    setMode: (m) => void (mode = m),
    set(tiles) {
      set.clear();
      for (const t of tiles) set.set(key(t), { x: t.x, y: t.y });
    },
    clear: () => set.clear(),
    begin(t) {
      from = to = t;
    },
    drag(t) {
      if (from) to = t;
    },
    end() {
      if (!from || !to) return false;
      let changed = false;
      for (const t of rectTiles(from, to)) {
        if (mode === 'add' && !set.has(key(t))) {
          set.set(key(t), t);
          changed = true;
        } else if (mode === 'erase' && set.delete(key(t))) changed = true;
      }
      from = to = null;
      return changed;
    },
    cancel() {
      from = to = null;
    },
    dragging: () => (from && to ? rectTiles(from, to) : []),
  };
}
