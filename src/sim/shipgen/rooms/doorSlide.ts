import type { Layout } from '../layout';

/**
 * Door slides: the station and room generators working together. The station draws a room's doors before anything is in
 * it; a room laid out from a design (rooms/designs.ts) may find a door's approach right where its main piece must
 * stand (a mass driver's bay with its door in the middle of the side wall). Such a door may slide a tile or two along the
 * same straight wall, onto a spot that still opens onto the same room or corridor on the other side, with nothing
 * standing on either side and every tile still reachable. Which rooms meet stays as the station planned it.
 */

export interface Slide { from: number; to: number }

/** The slides open to `room`'s doors, nearest first. */
export function doorSlides(lay: Layout, room: number, reach = 2): Slide[] {
  const W = lay.w;
  const out: (Slide & { k: number })[] = [];
  const seen = new Set<number>();
  for (const i of lay.roomTiles(room)) {
    for (const n of lay.neighbours(i)) {
      if (lay.cells[n] !== 'D' || seen.has(n)) continue;
      seen.add(n);
      const d = n - i;
      const o = n + d;
      if (lay.cells[o] !== '_') continue;
      const other = lay.roomOf[o];
      const a = Math.abs(d) === 1 ? W : 1;
      for (let k = 1; k <= reach; k++) {
        for (const s of [1, -1]) {
          const c = n + s * k * a;
          // The wall runs straight from the door to its new spot (one row, nothing mounted on it).
          let ok = a !== 1 || Math.floor(c / W) === Math.floor(n / W);
          for (let j = 1; j <= k && ok; j++) { const t = n + s * j * a; if (lay.cells[t] !== '#' || (lay.occ[t] ?? -1) >= 0) ok = false; }
          if (!ok) continue;
          const ci = c - d, co = c + d;
          if (lay.cells[ci] !== '_' || lay.roomOf[ci] !== room || lay.cells[co] !== '_' || lay.roomOf[co] !== other) continue;
          if ((lay.occ[ci] ?? -1) >= 0 || (lay.occ[co] ?? -1) >= 0) continue;
          // Wall either side of the new door (the old door's tile turns to wall).
          if (![c + a, c - a].every((t) => t === n || lay.cells[t] === '#')) continue;
          out.push({ from: n, to: c, k });
        }
      }
    }
  }
  return out.sort((p, q) => p.k - q.k).map(({ from, to }) => ({ from, to }));
}

/** Move a door (and the clear tiles either side of it, the Layout's door-side keep: an odd keep count). */
export function slideDoor(lay: Layout, s: Slide): void {
  lay.cells[s.from] = '#';
  lay.cells[s.to] = 'D';
  const r = lay.roomOf[s.from] as number;
  lay.roomOf[s.from] = lay.roomOf[s.to] as number;
  lay.roomOf[s.to] = r;
  const byDoor = (t: number): boolean => lay.neighbours(t).some((u) => lay.cells[u] === 'D');
  for (const t of lay.neighbours(s.from)) if (lay.cells[t] === '_' && (lay.keep[t] as number) % 2 === 1 && !byDoor(t)) lay.keep[t] = (lay.keep[t] as number) - 1;
  for (const t of lay.neighbours(s.to)) if (lay.cells[t] === '_' && (lay.keep[t] as number) % 2 === 0) lay.keep[t] = (lay.keep[t] as number) + 1;
}

/**
 * Try `fit` with each of the room's door slides in turn (nearest first), keeping the first slide it accepts; every
 * other slide is undone. Returns the fit's result, or null when no slide helps.
 */
export function withSlide<T>(lay: Layout, room: number, fit: () => T | null): T | null {
  for (const s of doorSlides(lay, room)) {
    const keep = lay.keep.slice();
    const base = lay.unreached();
    slideDoor(lay, s);
    const got = lay.unreached() <= base ? fit() : null;
    if (got) return got;
    slideDoor(lay, { from: s.to, to: s.from });
    lay.keep.set(keep);
  }
  return null;
}
