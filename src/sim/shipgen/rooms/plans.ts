import type { Rng } from '../../rng';
import { footprintTiles, rotatedSize, type Tile } from '../../modules/footprint';
import type { Layout, PlacedModule } from '../layout';
import { bedSides } from '../useTiles';

/**
 * Whole-room plans: a room laid out at once, piece by piece, each piece at the best-scoring spot of every spot it fits
 * (after Tutenel et al. 2009's rule-based layout solver: the layout's use rules trim the spots, attractors and
 * detractors weight the rest). Everything is placed or nothing (the caller falls back to the arrangement's steps).
 * Works on any room shape.
 *
 * Berths (quarters): each bed head to a wall with a locker beside its head. `rows` (barracks) lines the beds up along
 * a wall, a locker between each pair; `apart` (homes) spreads them round the walls in ones and twos, away from the
 * doors, and a room big enough gets a lounge table with chairs out on the floor, away from the beds. Life support goes
 * on a free wall, away from the beds.
 */

export type BerthStyle = 'rows' | 'apart';

interface Cand { pm: PlacedModule; score: number }

/** Chebyshev gap between two footprints (1 = touching, diagonals included). */
function gap(a: Tile[], b: Tile[]): number {
  let best = Infinity;
  for (const p of a) for (const q of b) best = Math.min(best, Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)));
  return best;
}

export function planBerths(
  lay: Layout, rng: Rng, room: number, beds: number, o: { lifeSupport: number; style: BerthStyle; lounge: boolean },
): boolean {
  const tiles = lay.roomTiles(room);
  if (tiles.length === 0) return false;
  const bed = lay.defs['module.bed'], locker = lay.defs['module.storage_locker'], ls = lay.defs['module.lifeSupport'], table = lay.defs['module.mess_table'];
  if (!bed || !locker || !ls) return false;
  const W = lay.w;
  const wall = (t: Tile): boolean => lay.at(t.x, t.y) === '#';
  const doors: Tile[] = [];
  for (const i of tiles) for (const n of lay.neighbours(i)) if (lay.cells[n] === 'D') doors.push({ x: n % W, y: Math.floor(n / W) });
  const xs = tiles.map((i) => i % W), ys = tiles.map((i) => Math.floor(i / W));
  const centre = { x: xs.reduce((a, b) => a + b, 0) / tiles.length, y: ys.reduce((a, b) => a + b, 0) / tiles.length };
  const base = lay.unreached();
  const n0 = lay.modules.length;
  const placedBeds: Tile[][] = [];
  const undo = (): false => { while (lay.modules.length > n0) lay.pop(); return false; };
  const put = (pm: PlacedModule): boolean => {
    if (lay.fitError(pm.def, pm.x, pm.y, pm.rot, room)) return false;
    lay.push(pm);
    if (lay.unreached() > base) { lay.pop(); return false; }
    return true;
  };
  /** Every spot `def` fits in the room, scored; the best is tried first (a little noise breaks ties by seed). */
  const best = (def: string, score: (pm: PlacedModule, fp: Tile[]) => number | null): boolean => {
    const d = lay.defs[def];
    if (!d) return false;
    const cands: Cand[] = [];
    for (const i of tiles) {
      for (let rot = 0; rot < 4; rot++) {
        if (d.footprint[0] === d.footprint[1] && rot > 0) break;
        const pm = { def, x: i % W, y: Math.floor(i / W), rot };
        if (lay.fitError(def, pm.x, pm.y, rot, room)) continue;
        const s = score(pm, footprintTiles(d, pm.x, pm.y, rot));
        if (s !== null) cands.push({ pm, score: s + rng.next() * 0.5 });
      }
    }
    cands.sort((a, b) => b.score - a.score);
    for (const c of cands.slice(0, 12)) if (put(c.pm)) return true;
    return false;
  };
  const doorGap = (fp: Tile[]): number => (doors.length > 0 ? gap(fp, doors) : 99);

  for (let k = 0; k < beds; k++) {
    const ok = best('module.bed', (pm, fp) => {
      const [w, h] = rotatedSize(bed, pm.rot);
      const ends: Tile[] = h > w ? [{ x: pm.x, y: pm.y - 1 }, { x: pm.x, y: pm.y + h }] : [{ x: pm.x - 1, y: pm.y }, { x: pm.x + w, y: pm.y }];
      if (!ends.some(wall)) return null; // head to a wall
      const sideWall = bedSides(bed, pm.x, pm.y, pm.rot).some((s) => s.every(wall));
      let s = 3 + (sideWall ? 1 : 0);
      const dg = doorGap(fp);
      if (dg <= 1) s -= 3; else if (dg === 2) s -= 1;
      for (const other of placedBeds) {
        const g = gap(fp, other);
        if (o.style === 'rows') {
          // A row: the next bed two along the same wall (a locker between), parallel.
          const sameLine = fp.some((p) => other.some((q) => (p.x === q.x || p.y === q.y)));
          if (g === 2 && sameLine) s += 4;
        } else {
          if (g <= 1) s -= 3;
          else if (g === 2) s -= placedBeds.length > 1 ? 1.5 : -0.5; // a pair shares a nightstand; more crowd
          else s += Math.min(g, 6) * 0.3;
        }
      }
      return s;
    });
    if (!ok) return undo();
    const pm = lay.modules[lay.modules.length - 1] as PlacedModule;
    const fp = footprintTiles(bed, pm.x, pm.y, pm.rot);
    placedBeds.push(fp);
    // Its locker beside the head (the end at the wall), against that wall if it can be.
    const [w, h] = rotatedSize(bed, pm.rot);
    const headAt0 = h > w ? wall({ x: pm.x, y: pm.y - 1 }) : wall({ x: pm.x - 1, y: pm.y });
    const head = headAt0 ? (fp[0] as Tile) : (fp[fp.length - 1] as Tile);
    const spots = h > w ? [{ x: head.x - 1, y: head.y }, { x: head.x + 1, y: head.y }] : [{ x: head.x, y: head.y - 1 }, { x: head.x, y: head.y + 1 }];
    for (const t of rng.chance(0.5) ? spots : [...spots].reverse()) {
      let done = false;
      for (let rot = 0; rot < 4 && !done; rot++) done = put({ def: 'module.storage_locker', x: t.x, y: t.y, rot });
      if (done) break;
    }
  }
  for (let k = 0; k < o.lifeSupport; k++) {
    const ok = best('module.lifeSupport', (pm, fp) => {
      const [w, h] = rotatedSize(ls, pm.rot);
      const back = h > w ? [fp.map((t) => ({ x: t.x - 1, y: t.y })), fp.map((t) => ({ x: t.x + w, y: t.y }))] : [fp.map((t) => ({ x: t.x, y: t.y - 1 })), fp.map((t) => ({ x: t.x, y: t.y + h }))];
      if (!back.some((s) => s.every(wall))) return null; // along a wall
      const near = placedBeds.length > 0 ? Math.min(...placedBeds.map((b) => gap(fp, b))) : 6;
      return Math.min(near, 6) * 0.5 - (doorGap(fp) <= 1 ? 2 : 0);
    });
    if (!ok) return undo();
  }
  if (o.lounge && table) {
    // The lounge: a table out on the floor (off the walls), toward the middle and away from the beds, two chairs at it.
    const ok = best('module.mess_table', (pm, fp) => {
      const ring = fp.flatMap((t) => [{ x: t.x + 1, y: t.y }, { x: t.x - 1, y: t.y }, { x: t.x, y: t.y + 1 }, { x: t.x, y: t.y - 1 }]);
      if (ring.some(wall)) return null;
      const near = placedBeds.length > 0 ? Math.min(...placedBeds.map((b) => gap(fp, b))) : 6;
      if (near < 2) return null;
      const c = { x: fp.reduce((a, t) => a + t.x, 0) / fp.length, y: fp.reduce((a, t) => a + t.y, 0) / fp.length };
      return Math.min(near, 5) * 0.5 - Math.hypot(c.x - centre.x, c.y - centre.y) * 0.4;
    });
    if (ok) {
      const t = lay.modules[lay.modules.length - 1] as PlacedModule;
      const [w, h] = rotatedSize(table, t.rot);
      // Chairs on the long sides, facing the table (r0 faces -y, r1 +x, r2 +y, r3 -x).
      const seats = w >= h
        ? [{ x: t.x + rng.int(0, w - 1), y: t.y - 1, rot: 2 }, { x: t.x + rng.int(0, w - 1), y: t.y + h, rot: 0 }]
        : [{ x: t.x - 1, y: t.y + rng.int(0, h - 1), rot: 1 }, { x: t.x + w, y: t.y + rng.int(0, h - 1), rot: 3 }];
      for (const s of seats) put({ def: 'module.chair', ...s });
    }
  }
  return true;
}
