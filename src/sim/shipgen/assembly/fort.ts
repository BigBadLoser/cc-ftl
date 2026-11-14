import type { RoomSpec } from '../plan';
import type { Asm } from './asm';
import type { Built, Ctx } from './model';
import { SPACE } from './regions';

/**
 * A fort (the user's pick, "F2": a star fort): a parade hall at the centre, an arm off each side of it (the recipe's
 * branches, each on the hall's port that heads its way), and in each corner between two arms a gun battery, one room
 * holding that corner's guns, pointing out along the diagonal. The arms leave the hall by a neck, so the batteries
 * stand against the hall's corners and open onto it.
 */

/** Of a battery's floor, the share its guns' bays take (as battery.ts). */
const SHARE = 0.5;
const SLACK = 20;
const QUADS: readonly [1 | -1, 1 | -1][] = [[1, -1], [1, 1], [-1, 1], [-1, -1]];

/** The parade hall: x and y from -h to h. A port on each side, at its middle, heading out. */
export function parade(ctx: Ctx, h: number): Built & { hall: number } {
  const { g } = ctx;
  const hall = g.hall('hall');
  g.rect(hall, -h, -h, h + 1, h + 1);
  const port = (x: number, y: number, dir: 'n' | 'e' | 's' | 'w'): Built['ports'][number] => ({ frame: { x, y, dir }, kind: 'rim', hall, along: 0, side: 0 });
  return { hall, regions: [hall], box: [-h, -h, h + 1, h + 1], ports: [port(0, -h - 1, 'n'), port(h + 1, 0, 'e'), port(0, h + 1, 's'), port(-h - 1, 0, 'w')] };
}

/** Guns shared out over the corners, biggest first, each to the corner with least floor asked of it so far. */
function share(guns: readonly RoomSpec[]): RoomSpec[][] {
  const out: RoomSpec[][] = [[], [], [], []], area = [0, 0, 0, 0];
  for (const gun of [...guns].sort((p, q) => q.w * q.h - p.w * p.h)) {
    const k = area.indexOf(Math.min(...area));
    (out[k] as RoomSpec[]).push(gun);
    area[k] = (area[k] as number) + gun.w * gun.h;
  }
  return out;
}

/**
 * The batteries, once the arms stand. Each is the open ground of its corner within a bastion's outline, grown out
 * along the diagonal until its floor holds its guns. It opens onto the hall alone, so it may stand against a gated arm.
 * Returns the guns that found no battery.
 */
export function batteries(a: Asm, hall: number, h: number, guns: readonly RoomSpec[]): RoomSpec[] {
  const { g, reserved } = a.ctx;
  const key = (x: number, y: number): number => (y + 2048) * 4096 + x + 2048;
  const left: RoomSpec[] = [];
  for (const [k, list] of share(guns).entries()) {
    if (list.length === 0) continue;
    const [sx, sy] = QUADS[k] as [1 | -1, 1 | -1];
    // (With slack: a small battery's walls and door take a bigger share of it.)
    const need = list.reduce((n, r) => n + r.w * r.h, 0) / SHARE + SLACK;
    // The open ground of the corner within reach of the hall's corner, in the corner's own frame (p, q from the centre).
    const tile = (p: number, q: number): [number, number] => [sx * p, sy * q];
    const open = (p: number, q: number): boolean => { const [x, y] = tile(p, q); return g.at(x, y) === SPACE && !reserved.has(key(x, y)) };
    // A diamond on the corner's diagonal, its inner point inside the hall's corner (so it opens onto the hall) and its
    // outer point the bastion's: 45-degree sides, cut off by the arms either side of it.
    const inside = (p: number, q: number, r: number): boolean => { const m = h + Math.floor(r / 2) - 1; return Math.abs(p - m) + Math.abs(q - m) <= r; };
    const spec: RoomSpec = { ...(list[0] as RoomSpec), dept: 'defence', mods: list.flatMap((r) => r.mods) };
    let placed = false;
    for (let r = 4; r <= 48 && !placed; r++) {
      const m = h + Math.floor(r / 2) - 1, set = new Set<string>();
      for (let q = 1; q <= m + r; q++) for (let p = 1; p <= m + r; p++) if (inside(p, q, r) && open(p, q)) set.add(`${p},${q}`);
      // No tile held by a corner alone (the diamond's points): each keeps two neighbours in the set along a side.
      for (let pruned = true; pruned;) {
        pruned = false;
        for (const t of [...set]) {
          const [p, q] = t.split(',').map(Number) as [number, number];
          const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dp, dq]) => set.has(`${p + (dp as number)},${q + (dq as number)}`)).length;
          if (n < 2) { set.delete(t); pruned = true; }
        }
      }
      const tiles = [...set].map((t) => { const [p, q] = t.split(',').map(Number) as [number, number]; return tile(p, q); });
      // Floor is what is not wall: roughly the tiles less one ring of them.
      if (tiles.length - 2 * Math.sqrt(tiles.length) * 2 < need) continue;
      const mark = g.mark(), before = g.blocks(-h - 80, -h - 80, h + 80, h + 80);
      const id = g.room(spec.role, { spec, access: [hall], rank: 1e5 + k });
      for (const [x, y] of tiles) g.set(x, y, id);
      const cell = g.compile();
      if (g.blocks(-h - 80, -h - 80, h + 80, h + 80) > before || g.stranded(cell).some(([, , o]) => o === id)) { g.reset(mark); continue; }
      placed = true;
    }
    if (!placed) left.push(...list);
  }
  return left;
}
