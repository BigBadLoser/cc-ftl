/**
 * Flush companions: the ore bins that go against a refinery's feed end. A planned host is placed with its first one
 * (generate.ts), and furnishing tops them up in turns once every host is in (furnish.ts).
 */
import type { Rng } from '../../rng';
import { accessTile, footprintTiles, rotatedSize } from '../../modules/footprint';
import type { ModuleDef } from '../../registry';
import type { Layout, PlacedModule } from '../layout';
import type { Step } from './types';

type With = NonNullable<Step['with']>;

/**
 * Set up to `n` bigger companions (ore bins) flush against a placed host, away from its access tile (the working end, so
 * the bins sit at the feed end), each turned so its own access tile is open floor. Every placement keeps the ship reachable.
 */
export function flank(lay: Layout, rng: Rng, room: number, host: PlacedModule, id: string, n: number): number {
  const hdef = lay.defs[host.def] as ModuleDef;
  const def = lay.defs[id];
  if (!def) return 0;
  const [hw, hh] = rotatedSize(hdef, host.rot);
  const work = accessTile(hdef, host.x, host.y, host.rot);
  // Tiles other modules are worked from: never covered.
  const worked = new Set<number>();
  for (const m of lay.modules) {
    const a = accessTile(lay.defs[m.def] as ModuleDef, m.x, m.y, m.rot);
    if (a && lay.inBounds(a.x, a.y)) worked.add(a.y * lay.w + a.x);
  }
  const reserve: number[] = [];
  let placed = 0;
  // Second pass: if the reserved walkway leaves no flush spot (a tight hall), a bin may take walkway floor, as long as
  // every tile stays reachable. The room's walkway marks are lifted for that pass only (and the reach baseline taken
  // after lifting them, so lifting them is no licence to seal a tile).
  for (const relax of [false, true]) {
    if (placed >= n) break;
    const lifted = relax ? lay.roomTiles(room).map((i) => [i, lay.keep[i] as number] as const) : [];
    for (const [i] of lifted) lay.keep[i] = 0;
    const base = lay.unreached();
    const cands: { x: number; y: number; rot: number; v: number }[] = [];
    for (let rot = 0; rot < 4; rot++) {
      const [w, h] = rotatedSize(def, rot);
      for (let y = host.y - h; y <= host.y + hh; y++) {
        for (let x = host.x - w; x <= host.x + hw; x++) {
          // Flush: shares an edge run with the host without overlapping it.
          const overlapX = Math.min(x + w, host.x + hw) - Math.max(x, host.x);
          const overlapY = Math.min(y + h, host.y + hh) - Math.max(y, host.y);
          const sideX = (x + w === host.x || x === host.x + hw) && overlapY > 0;
          const sideY = (y + h === host.y || y === host.y + hh) && overlapX > 0;
          if (!sideX && !sideY) continue;
          if (lay.fitError(id, x, y, rot, room) || footprintTiles(def, x, y, rot).some((t) => worked.has(t.y * lay.w + t.x))) continue;
          const dist = work ? Math.hypot(x + w / 2 - work.x - 0.5, y + h / 2 - work.y - 0.5) : 0;
          cands.push({ x, y, rot, v: dist + 0.5 * (sideX ? overlapY : overlapX) + rng.next() * 0.8 });
        }
      }
    }
    cands.sort((p, q) => q.v - p.v);
    for (const c of cands) {
      if (placed >= n) break;
      if (lay.fitError(id, c.x, c.y, c.rot, room)) continue;
      lay.push({ def: id, x: c.x, y: c.y, rot: c.rot });
      if (lay.unreached() > base) { lay.pop(); continue; }
      placed++;
      const a = accessTile(def, c.x, c.y, c.rot);
      if (a) reserve.push(a.y * lay.w + a.x);
    }
    // Put the lifted marks back on top of what the placed bins protect.
    for (const [i, k] of lifted) lay.keep[i] = (lay.keep[i] as number) + k;
    // Later furniture leaves each bin's working tile clear.
    for (const i of reserve.splice(0)) lay.keep[i] = (lay.keep[i] as number) + 1;
  }
  return placed;
}

/** How many companions of `w` already sit flush against the host. */
function flushCount(lay: Layout, host: PlacedModule, w: With): number {
  const box = (m: PlacedModule): [number, number, number, number] => {
    const [bw, bh] = rotatedSize(lay.defs[m.def] as ModuleDef, m.rot);
    return [m.x, m.y, m.x + bw, m.y + bh];
  };
  const [a0, b0, a1, b1] = box(host);
  return lay.modules.filter((m) => {
    if (m.def !== w.mod && m.def !== w.big) return false;
    const [x0, y0, x1, y1] = box(m);
    return ((x1 === a0 || x0 === a1) && Math.min(y1, b1) > Math.max(y0, b0)) || ((y1 === b0 || y0 === b1) && Math.min(x1, a1) > Math.max(x0, a0));
  }).length;
}

/**
 * A host's flush companions (ore bins beside a refinery) up to `w.n` counting those already flush: one big piece first
 * where it fits (if it has none yet), then small ones. Returns how many went in.
 */
export function withCompanions(lay: Layout, rng: Rng, room: number, host: PlacedModule, w: With): number {
  const had = flushCount(lay, host, w);
  if (had >= w.n) return 0;
  const big = w.big && had === 0 ? flank(lay, rng, room, host, w.big, 1) : 0;
  return big + (had + big < w.n ? flank(lay, rng, room, host, w.mod, w.n - had - big) : 0);
}

/**
 * True if the host has a flush companion, or one went in now (the big one if it fits, and it stays: hosts placed later
 * cannot take its floor; the rest come in turns while furnishing).
 */
export function claimCompanion(lay: Layout, rng: Rng, room: number, host: PlacedModule, w: With): boolean {
  return flushCount(lay, host, w) > 0 || withCompanions(lay, rng, room, host, { ...w, n: 1 }) > 0;
}
