import type { RoomSpec } from '../plan';
import type { Asm } from './asm';
import type { Built, Ctx } from './model';
import { SPACE } from './regions';

/**
 * A fort (the user's pick, "F2": a star fort): a parade hall at the centre, an arm off each side of it (the recipe's
 * branches, each on the hall's port that heads its way), and in each corner between two arms a gun battery, one room
 * holding that corner's guns, a sharp point out along the diagonal. The arms leave the hall by a neck, so the batteries
 * stand against the hall's corners and open onto it.
 */

/** Of a battery's floor, the share its guns' bays take (as battery.ts). */
const SHARE = 0.3;
const SLACK = 20;
/** How far a battery's side falls back from its point, for every tile across: above one, the point is sharp. */
const TAPER = 1.5;
const QUADS: readonly [1 | -1, 1 | -1][] = [[1, -1], [1, 1], [-1, 1], [-1, -1]];

/**
 * The parade hall: x and y from -h to h, with a neck `neck` tiles long and three wide out of the middle of each side.
 * A port at the end of each neck, heading out: the arms' streets are three wide too, on the hall's centre lines, so
 * an arm is as wide either side and the batteries between them come out alike.
 */
export function parade(ctx: Ctx, h: number, neck: number): Built & { hall: number } {
  const { g } = ctx;
  const hall = g.hall('hall');
  g.rect(hall, -h, -h, h + 1, h + 1);
  const e = h + neck;
  for (const [x0, y0, x1, y1] of [[-1, -e, 2, -h], [h + 1, -1, e + 1, 2], [-1, h + 1, 2, e + 1], [-e, -1, -h, 2]] as const) g.street(hall, x0, y0, x1, y1);
  const port = (x: number, y: number, dir: 'n' | 'e' | 's' | 'w'): Built['ports'][number] => ({ frame: { x, y, dir }, kind: 'rim', hall, along: 0, side: 0, width: 3 });
  return { hall, regions: [hall], box: [-e, -e, e + 1, e + 1], ports: [port(0, -e - 1, 'n'), port(e + 1, 0, 'e'), port(0, e + 1, 's'), port(-e - 1, 0, 'w')] };
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
 * The batteries, once the arms stand: one shape in all four corners, mirrored across both axes and across each
 * corner's diagonal (the user: "make them equal, and bigger"). It is the open ground every corner has, within a
 * point on the diagonal whose sides fall back a tile and a half for every tile across, so it reaches out between the
 * arms and wraps the hall's corner (it opens onto the hall). It grows until its floor holds the biggest corner's guns.
 * It opens onto the hall alone, so it may stand against a gated arm. Returns the guns that found no battery.
 */
export function batteries(a: Asm, hall: number, h: number, guns: readonly RoomSpec[]): RoomSpec[] {
  const { g, reserved } = a.ctx;
  const key = (x: number, y: number): number => (y + 2048) * 4096 + x + 2048;
  const lists = share(guns);
  // (With slack: a small battery's walls and door take a bigger share of it.)
  const need = Math.max(...lists.map((list) => list.reduce((n, r) => n + r.w * r.h, 0))) / SHARE + SLACK;
  // A tile in a corner's own frame (p, q out from the centre), and whether that corner has it open.
  const tile = (k: number, p: number, q: number): [number, number] => { const [sx, sy] = QUADS[k] as [1 | -1, 1 | -1]; return [sx * p, sy * q]; };
  const open = (k: number, p: number, q: number): boolean => { const [x, y] = tile(k, p, q); return g.at(x, y) === SPACE && !reserved.has(key(x, y)); };
  const everywhere = (p: number, q: number): boolean => [0, 1, 2, 3].every((k) => open(k, p, q) && open(k, q, p));
  const inside = (p: number, q: number, T: number): boolean => p + q + TAPER * Math.abs(p - q) <= T;
  const box = [-h - 120, -h - 120, h + 120, h + 120] as const;
  for (let T = 2 * h + 4; T <= 2 * h + 100; T += 2) {
    const set = new Set<string>();
    for (let q = 1; q <= T; q++) for (let p = 1; p <= T; p++) if (inside(p, q, T) && everywhere(p, q)) set.add(`${p},${q}`);
    // No tile held by a corner alone (the tips): each keeps two neighbours in the set along a side.
    for (let pruned = true; pruned;) {
      pruned = false;
      for (const t of [...set]) {
        const [p, q] = t.split(',').map(Number) as [number, number];
        const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dp, dq]) => set.has(`${p + (dp as number)},${q + (dq as number)}`)).length;
        if (n < 2) { set.delete(t); pruned = true; }
      }
    }
    // Floor is what is not wall: roughly the tiles less one ring of them.
    if (set.size - 4 * Math.sqrt(set.size) < need) continue;
    const pq = [...set].map((t) => t.split(',').map(Number) as [number, number]);
    const mark = g.mark(), before = g.blocks(...box), ids: number[] = [];
    for (const [k, list] of lists.entries()) {
      if (list.length === 0) continue;
      const spec: RoomSpec = { ...(list[0] as RoomSpec), dept: 'defence', mods: list.flatMap((r) => r.mods) };
      const id = g.room(spec.role, { spec, access: [hall], rank: 1e5 + k });
      ids.push(id);
      for (const [p, q] of pq) g.set(...tile(k, p, q), id);
    }
    const cell = g.compile();
    if (g.blocks(...box) > before || g.stranded(cell).some(([, , o]) => ids.includes(o))) { g.reset(mark); continue; }
    return [];
  }
  return [...guns];
}
