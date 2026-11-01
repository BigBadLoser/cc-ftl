import type { Rng } from '../../rng';
import { footprintTiles } from '../../modules/footprint';
import type { ModuleDef } from '../../registry';
import type { Layout } from '../layout';
import type { Vignette, VignetteSet } from './types';

/**
 * Vignettes: small hand-made groups of furniture (a food stand with its tables, a market stall, a lounge) set into big
 * open rooms at spaced spots with clear floor round each, instead of one module repeated on a lattice. The Spelunky way
 * of mixing authored pieces into a generated layout (docs/LAYOUT_RESEARCH.md): each piece is fixed, where it goes and
 * which way it turns is not. Chairs turn to face the nearest table of their piece.
 */

type Tile = { x: number; y: number };

/** A piece's modules turned `k` quarter turns clockwise about its origin, as (x, y, rot) of each footprint's corner. */
export function turned(defs: Record<string, ModuleDef>, v: Vignette, k: number): { def: string; x: number; y: number; rot: number }[] {
  const turn = (t: Tile): Tile => {
    let { x, y } = t;
    for (let i = 0; i < k; i++) [x, y] = [-y, x];
    return { x, y };
  };
  const out = v.mods.map((m) => {
    const def = defs[m.mod] as ModuleDef;
    const tiles = footprintTiles(def, m.x, m.y, m.rot ?? 0).map(turn);
    return { def: m.mod, x: Math.min(...tiles.map((t) => t.x)), y: Math.min(...tiles.map((t) => t.y)), rot: ((m.rot ?? 0) + k) % 4 };
  });
  // Chairs face the nearest table (or counter) of the piece.
  const seats = out.filter((m) => m.def === 'module.chair');
  const tables = out.filter((m) => m.def !== 'module.chair');
  for (const c of seats) {
    const centre = (m: { def: string; x: number; y: number; rot: number }): [number, number] => {
      const t = footprintTiles(defs[m.def] as ModuleDef, m.x, m.y, m.rot);
      return [t.reduce((a, q) => a + q.x, 0) / t.length, t.reduce((a, q) => a + q.y, 0) / t.length];
    };
    const near = tables.map(centre).sort((p, q) => Math.hypot(p[0] - c.x, p[1] - c.y) - Math.hypot(q[0] - c.x, q[1] - c.y))[0];
    if (!near) continue;
    const [tx, ty] = near;
    c.rot = Math.abs(tx - c.x) >= Math.abs(ty - c.y) ? (tx >= c.x ? 1 : 3) : ty >= c.y ? 2 : 0;
  }
  return out;
}

/**
 * Set pieces from `set` into `room` until its floor share under them reaches `set.upTo`: each at a free spot at least
 * `set.gap` tiles from the last ones, with a tile of clear floor round it, every tile still reachable. Powered modules
 * draw from `power.spare` (a piece that needs more is skipped). Returns how many pieces went in.
 */
export function placeVignettes(lay: Layout, rng: Rng, room: number, set: VignetteSet, power: { spare: number }): number {
  const floor = lay.roomTiles(room);
  if (floor.length < (set.minFloor ?? 60)) return 0;
  const target = floor.length * set.upTo;
  const centres: Tile[] = [];
  let covered = 0;
  let placed = 0;
  // Candidate anchors in a shuffled order (seeded), each tried with a random piece and turn; a big room's centrepiece
  // first, tried outward from the middle of the floor.
  const spots = floor.map((i) => ({ x: i % lay.w, y: Math.floor(i / lay.w), k: rng.next(), v: undefined as Vignette | undefined })).sort((a, b) => a.k - b.k);
  if (set.centre && floor.length >= (set.centreFloor ?? 300)) {
    const mx = spots.reduce((t, s) => t + s.x, 0) / spots.length;
    const my = spots.reduce((t, s) => t + s.y, 0) / spots.length;
    const middle = [...spots].sort((a, b) => Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my)).slice(0, 150);
    spots.unshift(...middle.map((s) => ({ ...s, v: set.centre })));
  }
  let landmark = false;
  for (const s of spots) {
    if (covered >= target && (landmark || !s.v)) break;
    if (s.v && landmark) continue;
    if (!s.v && centres.some((c) => Math.hypot(c.x - s.x, c.y - s.y) < set.gap)) continue;
    const v = s.v ?? (set.pieces[Math.floor(rng.next() * set.pieces.length)] as Vignette);
    const draw = v.mods.reduce((t, m) => t + Math.max(0, -((lay.defs[m.mod] as ModuleDef | undefined)?.power ?? 0)), 0);
    if (draw > power.spare) continue;
    const k = Math.floor(rng.next() * 4);
    const mods = turned(lay.defs, v, k).map((m) => ({ ...m, x: m.x + s.x, y: m.y + s.y }));
    const tiles = mods.flatMap((m) => footprintTiles(lay.defs[m.def] as ModuleDef, m.x, m.y, m.rot));
    // Clear floor round the piece: no other module (lamps aside) within one tile of it.
    const own = new Set(tiles.map((t) => t.y * lay.w + t.x));
    const ring = tiles.flatMap((t) => [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].map(([dx, dy]) => (t.y + (dy as number)) * lay.w + t.x + (dx as number)));
    if (ring.some((i) => !own.has(i) && lay.inBounds(i % lay.w, Math.floor(i / lay.w)) && (lay.occ[i] ?? -1) >= 0 && lay.modules[lay.occ[i] as number]?.def !== 'module.light')) continue;
    const base = lay.unreached();
    let n = 0;
    for (const m of mods) {
      if (lay.fitError(m.def, m.x, m.y, m.rot, room)) break;
      lay.push({ def: m.def, x: m.x, y: m.y, rot: m.rot });
      n++;
    }
    if (n < mods.length || lay.unreached() > base) {
      for (let i = 0; i < n; i++) lay.pop();
      continue;
    }
    power.spare -= draw;
    if (s.v) landmark = true;
    centres.push({ x: s.x, y: s.y });
    covered += tiles.length;
    placed++;
  }
  return placed;
}
