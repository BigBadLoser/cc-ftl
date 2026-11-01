import type { Layout, PlacedModule } from '../layout';

/**
 * A room frame: a rectangular room seen from its back wall, so a room design is written once and set in any of the
 * room's four turns. u runs along the back wall (0 .. L-1), v from the back wall into the room (0 .. D-1). A piece set
 * with frame turn 0 has its front (access side) toward +v, away from the back wall; turn 2 faces the back wall; 1 and 3
 * face along the wall. The frame turn o says which wall is the back: 0 north, 1 east, 2 south, 3 west.
 */
export interface Frame { o: number; L: number; D: number; x0: number; y0: number; x1: number; y1: number }

/** The room's rectangle, if its floor is one (null for any other shape). */
export function roomRect(lay: Layout, room: number): { x0: number; y0: number; x1: number; y1: number } | null {
  const tiles = lay.roomTiles(room);
  if (tiles.length === 0) return null;
  const xs = tiles.map((i) => i % lay.w), ys = tiles.map((i) => Math.floor(i / lay.w));
  const r = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  return (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1) === tiles.length ? r : null;
}

export function frame(r: { x0: number; y0: number; x1: number; y1: number }, o: number): Frame {
  const w = r.x1 - r.x0 + 1, h = r.y1 - r.y0 + 1;
  return { o, L: o % 2 === 0 ? w : h, D: o % 2 === 0 ? h : w, ...r };
}

/** The world tile of frame tile (u, v). */
export function at(f: Frame, u: number, v: number): { x: number; y: number } {
  switch (f.o) {
    case 0: return { x: f.x0 + u, y: f.y0 + v };
    case 1: return { x: f.x1 - v, y: f.y0 + u };
    case 2: return { x: f.x1 - u, y: f.y1 - v };
    default: return { x: f.x0 + v, y: f.y1 - u };
  }
}

/** The size (along u, along v) of a piece of footprint [fw, fh] set with frame turn t. */
export function frameSize(fp: readonly [number, number], t: number): [number, number] {
  return t % 2 === 0 ? [fp[0], fp[1]] : [fp[1], fp[0]];
}

/** The placed module for `def` covering frame tiles u..u+du-1, v..v+dv-1 with frame turn t. */
export function framed(lay: Layout, f: Frame, def: string, u: number, v: number, t: number): PlacedModule {
  const d = lay.defs[def];
  const [du, dv] = frameSize(d?.footprint ?? [1, 1], t);
  const a = at(f, u, v), b = at(f, u + du - 1, v + dv - 1);
  return { def, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), rot: (t + f.o) % 4 };
}

/** Doors in the frame's back wall row (v = -1): a design keeps its back wall free of them. */
export function backDoors(lay: Layout, f: Frame): number {
  let n = 0;
  for (let u = 0; u < f.L; u++) { const t = at(f, u, -1); if (lay.at(t.x, t.y) === 'D') n++; }
  return n;
}
