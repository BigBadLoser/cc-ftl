import type { Rng } from '../../rng';
import { footprintTiles } from '../../modules/footprint';
import type { ModuleDef } from '../../registry';
import type { Layout } from '../layout';
import type { Vignette } from './types';
import { turned } from './vignettes';

/**
 * Islands: a roomy room uses its middle. After the recipe's steps (which mostly back pieces onto walls), while one of the
 * recipe's islands (the first that fits, in the recipe's order) fits on open floor with clear floor on every side (a reserved walkway may be that floor, never
 * under the island), it goes in at the spot nearest the room's middle (a reactor room's control desk, a hold's rack
 * island): open floor reads as arranged, not left over. A room only as big as its contents has no such spot and stays as
 * it is. At most MAX islands a room, every tile still reachable, every piece still usable (Layout.fitError).
 */

const MAX = 1;

const drawOf = (lay: Layout, v: Vignette): number => v.mods.reduce((t, m) => t + Math.max(0, -((lay.defs[m.mod] as ModuleDef | undefined)?.power ?? 0)), 0);

/** Set islands into `room`'s open middle; returns how many modules went in. Powered pieces draw from `power.spare`. */
export function placeIslands(lay: Layout, rng: Rng, room: number, islands: readonly Vignette[], power: { spare: number }): number {
  const W = lay.w;
  const tiles = lay.roomTiles(room);
  if (tiles.length === 0 || islands.length === 0) return 0;
  const inRoom = new Set(tiles);
  const open = (i: number): boolean => inRoom.has(i) && (lay.occ[i] ?? -1) < 0;
  const cx = tiles.reduce((t, i) => t + (i % W), 0) / tiles.length, cy = tiles.reduce((t, i) => t + Math.floor(i / W), 0) / tiles.length;
  // What a desk faces: the room's biggest machine (its seats go on the far side, the operators looking at it).
  let big: { x: number; y: number } | null = null, area = 0;
  for (const m of lay.modules) {
    const fp = footprintTiles(lay.defs[m.def] as ModuleDef, m.x, m.y, m.rot);
    if (fp.length > area && fp.some((t) => inRoom.has(t.y * W + t.x))) { area = fp.length; big = { x: fp.reduce((a, t) => a + t.x, 0) / fp.length, y: fp.reduce((a, t) => a + t.y, 0) / fp.length }; }
  }
  let placed = 0;
  for (let n = 0; n < MAX; n++) {
    let done = false;
    // The recipe's islands in order of preference: the first that fits anywhere goes in, at its best spot.
    for (const v of islands) {
      if (done) break;
      const spots: { rel: ReturnType<typeof turned>; dx: number; dy: number; d: number }[] = [];
      if (drawOf(lay, v) > power.spare) continue;
      for (let k = 0; k < 4; k++) {
        const rel = turned(lay.defs, v, k);
        const fp = rel.flatMap((m) => footprintTiles(lay.defs[m.def] as ModuleDef, m.x, m.y, m.rot));
        const f0 = fp[0];
        if (!f0) continue;
        for (const a of tiles) {
          const dx = (a % W) - f0.x, dy = Math.floor(a / W) - f0.y;
          const own = fp.map((t) => (t.y + dy) * W + t.x + dx);
          if (!own.every((i) => open(i) && !lay.keep[i])) continue;
          const mine = new Set(own);
          let ring = true;
          for (const i of own) for (const j of [i + 1, i - 1, i + W, i - W]) if (!mine.has(j) && !open(j)) ring = false;
          if (!ring) continue;
          const mx = own.reduce((t, i) => t + (i % W), 0) / own.length, my = own.reduce((t, i) => t + Math.floor(i / W), 0) / own.length;
          const seats = rel.filter((m) => m.def === 'module.chair'), desks = rel.filter((m) => m.def !== 'module.chair');
          const dist = (ms: typeof rel): number => (big && ms.length > 0 ? ms.reduce((t, m) => t + Math.hypot(m.x + dx - big.x, m.y + dy - big.y), 0) / ms.length : 0);
          const backwards = seats.length > 0 && dist(seats) < dist(desks) ? 4 : 0;
          spots.push({ rel, dx, dy, d: Math.hypot(mx - cx, my - cy) + backwards + rng.next() * 0.5 });
        }
      }
      spots.sort((p, q) => p.d - q.d);
      for (const s of spots.slice(0, 24)) {
        const base = lay.unreached();
        let k = 0;
        for (const m of s.rel) {
          if (lay.fitError(m.def, m.x + s.dx, m.y + s.dy, m.rot, room)) break;
          lay.push({ def: m.def, x: m.x + s.dx, y: m.y + s.dy, rot: m.rot });
          k++;
        }
        if (k < s.rel.length || lay.unreached() > base) { for (let i = 0; i < k; i++) lay.pop(); continue; }
        power.spare -= drawOf(lay, v);
        placed += k;
        done = true;
        break;
      }
    }
    if (!done) break;
  }
  return placed;
}
