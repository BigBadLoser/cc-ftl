/**
 * RW: a refinery hall's machines against the walls, the doorways clear. Each refinery stands flush to a wall (back, side
 * or front), its working tile free and off every doorway (three wide, two deep), off the other machines and their working tiles; its ore bin
 * (its feed) flush beside it, also off the doorways. Placed one at a time where it is furthest from the doors and the
 * machines already standing; left out (the room is tried another way) when a refinery finds no spot.
 * Room frame of parts.ts: (0, 0) the top-left floor tile, the main door under the bottom wall at column d.
 */
import { accessTiles, footprintTiles } from '../../../modules/footprint';
import { doorways } from './mess';
import type { Piece } from './check';
import { OB, P, RF, count } from './parts';
import type { Ctx } from './rules';

type Tiles = readonly { x: number; y: number }[];
const key = (x: number, y: number): string => `${x},${y}`;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export function rw(c: Ctx): Piece[] {
  const rf = c.defs[RF], ob = c.defs[OB];
  if (!rf || !ob) return [];
  const clear = doorways(c), doors = [...clear].map((s) => s.split(',').map(Number) as [number, number]);
  const cut = new Set((c.cut ?? []).map((t) => key(t.x, t.y)));
  const floor = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < c.w && y < c.h && !cut.has(key(x, y));
  const taken = new Set<string>(), out: Piece[] = [], machines: [number, number][] = [];
  const against = (t: Tiles): boolean => t.some((p) => N4.some(([dx, dy]) => !floor(p.x + dx, p.y + dy)));
  const spare = (t: Tiles): boolean => t.every((p) => floor(p.x, p.y) && !clear.has(key(p.x, p.y)) && !taken.has(key(p.x, p.y)));
  const apart = (t: Tiles, list: readonly [number, number][]): number => Math.min(4, ...list.map(([x, y]) => Math.min(...t.map((p) => Math.max(Math.abs(p.x - x), Math.abs(p.y - y))))));
  for (let i = 0; i < Math.max(1, count(c.need, RF)); i++) {
    let best: { x: number; y: number; rot: number; fp: Tiles; acc: Tiles } | null = null, score = -Infinity;
    for (let rot = 0; rot < 4; rot++) for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
      const fp = footprintTiles(rf, x, y, rot), acc = accessTiles(rf, x, y, rot);
      if (!spare(fp) || !against(fp) || !spare(acc)) continue;
      const s = 3 * apart([...fp, ...acc], doors) + apart(fp, machines) - 0.01 * (x + y * c.w);
      if (s > score) { score = s; best = { x, y, rot, fp, acc }; }
    }
    if (!best) return [];
    const placed = best;
    for (const t of [...placed.fp, ...placed.acc]) taken.add(key(t.x, t.y));
    out.push(P(RF, placed.x, placed.y, placed.rot));
    machines.push(...placed.fp.map((t): [number, number] => [t.x, t.y]));
    // Its ore bin flush beside it, off the doorways, its own working tile free.
    let bin: Piece | null = null, bs = -Infinity;
    for (let rot = 0; rot < 4; rot++) for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
      const fp = footprintTiles(ob, x, y, rot), acc = accessTiles(ob, x, y, rot);
      if (!spare(fp) || !spare(acc) || !fp.some((p) => N4.some(([dx, dy]) => placed.fp.some((q) => q.x === p.x + dx && q.y === p.y + dy)))) continue;
      const s = (against(fp) ? 10 : 0) + apart(fp, doors) - 0.01 * (x + y * c.w);
      if (s > bs) { bs = s; bin = P(OB, x, y, rot); }
    }
    // Every refinery has its bin (the room is tried another way without).
    if (!bin) return [];
    for (const t of [...footprintTiles(ob, bin.x, bin.y, bin.rot), ...accessTiles(ob, bin.x, bin.y, bin.rot)]) taken.add(key(t.x, t.y));
    out.push(bin);
  }
  return out;
}
