import type { Rng } from '../../rng';
import { footprintTiles } from '../../modules/footprint';
import type { ModuleDef } from '../../registry';
import type { Layout } from '../layout';
import type { CourtPlan, Vignette } from './types';
import { turned } from './vignettes';

/**
 * Courts laid out as a place, not a scatter: the plan's landmark first, as near the middle as it fits with a tile of
 * clear floor round it; then promenades, two tiles wide, leading from every door to it by the shortest way (a tree:
 * each door to the nearest tile already joined; door to door when there is no landmark); then the floor between them splits into zones,
 * each given one theme (a seating area, a row of stalls, a grove, a lab corner) whose pieces are set densely in it; a
 * few hedge planters mark each zone where it meets a promenade (its floor does the rest); with no landmark, a brass
 * inlay marks the court's middle on its promenade. Pieces and planters are the existing modules: the zoning is what is new.
 */

type T = { x: number; y: number };

/** Least gap between two hedge markers on a zone's edge. */
const HEDGE_GAP = 5;
/** Zones bigger than this are cut in two. */
const ZONE_MAX = 80;

export function planCourt(lay: Layout, rng: Rng, room: number, plan: CourtPlan, power: { spare: number }): number {
  const floor = lay.roomTiles(room);
  if (floor.length < 60) return 0;
  const W = lay.w;
  const inRoom = new Set(floor);
  /** Connected pieces of a set of tiles. */
  const pieces = (tiles: number[]): number[][] => {
    const set = new Set(tiles);
    const seen = new Set<number>();
    const out: number[][] = [];
    for (const t of tiles) {
      if (seen.has(t)) continue;
      const z = [t];
      seen.add(t);
      for (let q = 0; q < z.length; q++) for (const n of lay.neighbours(z[q] as number)) if (set.has(n) && !seen.has(n)) { seen.add(n); z.push(n); }
      out.push(z);
    }
    return out;
  };
  const doorIn: number[] = [];
  for (const i of floor) if (lay.neighbours(i).some((n) => lay.cells[n] === 'D')) doorIn.push(i);
  // The court's own promenades replace the walkway reserved for it: lift that (the odd one; a placed piece's use tiles
  // count in twos and stay), but for the tiles at its doors.
  const nearDoor = new Set(doorIn.flatMap((i) => [i, ...lay.neighbours(i)]));
  for (const i of floor) if (!nearDoor.has(i)) lay.keep[i] = (lay.keep[i] as number) - ((lay.keep[i] as number) % 2);
  const mx = floor.reduce((t, i) => t + (i % W), 0) / floor.length, my = floor.reduce((t, i) => t + Math.floor(i / W), 0) / floor.length;
  const byMiddle = (p: number, q: number): number => Math.hypot((p % W) - mx, Math.floor(p / W) - my) - Math.hypot((q % W) - mx, Math.floor(q / W) - my);
  let placed = 0;
  // The landmark: centred on the floor tile nearest the middle that takes it whole, with a clear ring round it.
  const solid = new Set<number>();
  const ring = new Set<number>();
  /** The power a piece draws (a holo column's light). */
  const drawOf = (v: Vignette): number => v.mods.reduce((t, m) => t + Math.max(0, -((lay.defs[m.mod] as ModuleDef | undefined)?.power ?? 0)), 0);
  if (plan.centres) {
    const at = [...floor].sort(byMiddle);
    const fits = (centre: Vignette, a: number, r: number): boolean => {
      // The landmark goes in even on a station short of power: it is the court's centrepiece, and the lowest priority
      // load (the sim sheds it first). Its draw still counts against the spare.
      const rel = turned(lay.defs, centre, r);
      const relTiles = rel.flatMap((m) => footprintTiles(lay.defs[m.def] as ModuleDef, m.x, m.y, m.rot));
      const cx = Math.round((Math.min(...relTiles.map((t) => t.x)) + Math.max(...relTiles.map((t) => t.x))) / 2);
      const cy = Math.round((Math.min(...relTiles.map((t) => t.y)) + Math.max(...relTiles.map((t) => t.y))) / 2);
      const dx = (a % W) - cx, dy = Math.floor(a / W) - cy;
      const own = new Set(relTiles.map((t) => (t.y + dy) * W + t.x + dx));
      const round = new Set<number>();
      for (const i of own) for (let ey = -1; ey <= 1; ey++) for (let ex = -1; ex <= 1; ex++) if (!own.has(i + ey * W + ex)) round.add(i + ey * W + ex);
      if (![...own, ...round].every((i) => inRoom.has(i) && (lay.occ[i] ?? -1) < 0)) return false;
      const base = lay.unreached();
      let n = 0;
      for (const m of rel) {
        if (lay.fitError(m.def, m.x + dx, m.y + dy, m.rot, room)) break;
        lay.push({ def: m.def, x: m.x + dx, y: m.y + dy, rot: m.rot });
        n++;
      }
      if (n < rel.length || lay.unreached() > base) { for (let i = 0; i < n; i++) lay.pop(); return false; }
      for (const i of own) solid.add(i);
      for (const i of round) ring.add(i);
      power.spare -= drawOf(centre);
      placed += n;
      return true;
    };
    plan.centres.some((v) => at.some((a) => [0, 1, 2, 3].sort(() => rng.next() - 0.5).some((r) => fits(v, a, r))));
  }
  // Promenades: a tree of shortest walks from the landmark's ring (or the first door) to every door, widened to two.
  const walk = new Set<number>(ring);
  const bfs = (from: Set<number>): Map<number, number> => {
    const prev = new Map<number, number>();
    const queue = [...from];
    for (const i of from) prev.set(i, -1);
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q] as number;
      for (const n of lay.neighbours(i)) if (inRoom.has(n) && !solid.has(n) && !prev.has(n)) { prev.set(n, i); queue.push(n); }
    }
    return prev;
  };
  if (doorIn.length > 0) {
    if (walk.size === 0) walk.add(doorIn[0] as number);
    for (const d of doorIn) {
      const prev = bfs(new Set(walk));
      for (let i = d; i >= 0 && !walk.has(i); i = prev.get(i) ?? -1) walk.add(i);
    }
  }
  const wide = new Set([...walk, ...solid]);
  for (const i of walk) lay.keep[i] = (lay.keep[i] as number) + 1;
  for (const i of walk) {
    if (ring.has(i)) continue;
    const x = i % W, y = Math.floor(i / W);
    for (const j of [(y + 1) * W + x, y * W + x + 1]) if (inRoom.has(j) && !solid.has(j)) wide.add(j);
  }
  // Zones: the floor off the promenades, in connected pieces; small scraps stay open floor. A zone over ZONE_MAX tiles is
  // cut in two by a one-tile path across its middle (its longer way), again until none is, so a big court mixes themes.
  for (let pass = 0; pass < 6; pass++) {
    const parts = pieces(floor.filter((i) => !wide.has(i)));
    const big = parts.filter((z) => z.length > ZONE_MAX);
    if (big.length === 0) break;
    for (const z of big) {
      const xs = z.map((i) => i % W), ys = z.map((i) => Math.floor(i / W));
      const alongX = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys);
      const mid = Math.round(alongX ? (Math.min(...xs) + Math.max(...xs)) / 2 : (Math.min(...ys) + Math.max(...ys)) / 2);
      for (const i of z) if ((alongX ? i % W : Math.floor(i / W)) === mid) wide.add(i);
    }
  }
  const off = floor.filter((i) => !wide.has(i));
  const offSet = new Set(off);
  const zoneOf = new Map<number, number>();
  const zones: number[][] = [];
  for (const i of off) {
    if (zoneOf.has(i)) continue;
    const z: number[] = [i];
    zoneOf.set(i, zones.length);
    for (let q = 0; q < z.length; q++) for (const n of lay.neighbours(z[q] as number)) if (offSet.has(n) && !zoneOf.has(n)) { zoneOf.set(n, zones.length); z.push(n); }
    zones.push(z);
  }
  const themes = plan.zones.map((_, k) => k).sort(() => rng.next() - 0.5);
  // Floors: the court paved as its promenades, the landmark and each zone as their own.
  const fin = plan.finish ?? {};
  for (const i of floor) lay.finish[i] = fin.walk ?? 0;
  for (const i of solid) lay.finish[i] = fin.centre ?? fin.walk ?? 0;
  zones.filter((z) => z.length >= 16).sort((a, b) => b.length - a.length).forEach((zone, zi) => {
    const tk = themes[zi % themes.length] as number;
    const theme = plan.zones[tk] as readonly Vignette[];
    for (const i of zone) lay.finish[i] = fin.zones?.[tk] ?? fin.zone ?? fin.walk ?? 0;
    const zset = new Set(zone);
    // The hedge: a few markers along the zone's promenade edge, not a wall of them (the zone's floor already marks it):
    // the ends of each edge run first, then any edge tile HEDGE_GAP or more from the last.
    const hedge = plan.hedge;
    const edge = hedge ? zone.filter((i) => lay.neighbours(i).some((n) => wide.has(n) && !solid.has(n))) : [];
    const onEdge = new Set(edge);
    const ends = edge.filter((i) => lay.neighbours(i).filter((n) => onEdge.has(n)).length <= 1);
    const marks: number[] = [];
    for (const i of [...ends, ...edge]) {
      if (!hedge || marks.some((j) => Math.max(Math.abs((j % W) - (i % W)), Math.abs(Math.floor(j / W) - Math.floor(i / W))) < HEDGE_GAP)) continue;
      if (!lay.fitError(hedge, i % W, Math.floor(i / W), 0, room)) {
        const base = lay.unreached();
        lay.push({ def: hedge, x: i % W, y: Math.floor(i / W), rot: 0 });
        if (lay.unreached() > base) lay.pop(); else { placed++; marks.push(i); }
      }
    }
    // The theme's pieces, densely: anchors in reading order, each piece where it fits whole inside the zone.
    let covered = 0;
    const target = zone.length * plan.fill;
    const anchors = [...zone].sort((a, b) => a - b);
    for (const a of anchors) {
      if (covered >= target) break;
      const v = theme[Math.floor(rng.next() * theme.length)] as Vignette;
      const draw = drawOf(v);
      if (draw > power.spare) continue;
      for (const r of [0, 1, 2, 3].sort(() => rng.next() - 0.5)) {
        const mods = turned(lay.defs, v, r).map((m) => ({ ...m, x: m.x + (a % W), y: m.y + Math.floor(a / W) }));
        const tiles = mods.flatMap((m) => footprintTiles(lay.defs[m.def] as ModuleDef, m.x, m.y, m.rot));
        if (!tiles.every((t: T) => zset.has(t.y * W + t.x))) continue;
        // A tile of clear floor round the piece (hedge and lamps aside), so pieces read as groups, not one mass.
        const own = new Set(tiles.map((t) => t.y * W + t.x));
        const crowded = tiles.some((t) => [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].some(([dx, dy]) => {
          const j = (t.y + (dy as number)) * W + t.x + (dx as number);
          const o = lay.occ[j] ?? -1;
          const od = o >= 0 ? lay.modules[o]?.def : undefined;
          return !own.has(j) && !!od && od !== plan.hedge && !lay.defs[od]?.light;
        }));
        if (crowded) continue;
        const base = lay.unreached();
        let n = 0;
        for (const m of mods) {
          if (lay.fitError(m.def, m.x, m.y, m.rot, room)) break;
          lay.push({ def: m.def, x: m.x, y: m.y, rot: m.rot });
          n++;
        }
        if (n < mods.length || lay.unreached() > base) { for (let i = 0; i < n; i++) lay.pop(); continue; }
        power.spare -= draw;
        covered += tiles.length;
        placed += n;
        break;
      }
    }
  });
  // No landmark: an inlay on the promenade, nearest the court's middle.
  if (solid.size === 0 && walk.size > 0) {
    const mid = [...walk].sort(byMiddle)[0] as number;
    if (!lay.fitError('module.deck_inlay', mid % W, Math.floor(mid / W), 0, room)) { lay.push({ def: 'module.deck_inlay', x: mid % W, y: Math.floor(mid / W), rot: 0 }); placed++; }
  }
  return placed;
}
