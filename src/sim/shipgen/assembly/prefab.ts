import type { RoomSpec } from '../plan';
import type { RoomRole } from '../types';
import type { Ctx } from './model';
import { key } from './model';
import { SOLID, SPACE } from './regions';

/**
 * A prefab base on open ground (the asteroid trading outpost's; mock sheet "prefab", P1 "node", issue #508): the
 * station as separate modules standing on levelled rock, joined by short tubes, the ground between them open.
 *   module  one standard prefab: six tiles inside (eight with its walls), its corners cut, a straight run of rooms
 *           along it, a partition with a door between each; as long as its rooms' floor needs (each six deep)
 *   tube    one tile wide inside, three long, straight, a door at each end in the modules' walls
 * The layout, north up: two landing pads on the ground (one for visitors, one for the base's own shuttle; #509), the
 * entry module under them (office | arrivals | armoury, an airlock in arrivals' outer wall under each pad) with customs
 * as the stem of its T, then a column of junctions below customs, each a module of plain hall. Every department is a
 * module of its own off a junction, on a tube of its own: walking through rooms happens only inside one department
 * (the workshop to the cargo hold, the core to the reactors). Row by row, nearest customs first: the market and the
 * mess; the stores and the barracks; command and the medbay; the guns off the last junction's far end.
 * Painted solid first, floor cut out, so every wall is one tile; a cut corner is a stair of wall (the seal rule allows
 * no floor diagonal to space, so the floor's corner tile is wall too).
 */

/** Tiles inside a module, across it. */
export const PREFAB_WIDE = 6;
/** Landing pads, each with its airlock: the airlocks a prefab base has. */
export const PREFAB_PADS = 2;
/** A module's outer width. */
const OUT = PREFAB_WIDE + 2;
/** Floor tiles in a tube, wall to wall: the ground between two modules it joins. */
const TUBE = 3;
/** A landing pad's side. */
const PAD = 9;
/** Customs' length down the entry's stem. */
const CUSTOMS = 8;

type Box = [number, number, number, number];
interface Seg { spec?: RoomSpec; hall?: number; len: number; annexed?: boolean }
interface Module { box: Box; dir: 'h' | 'v'; segs: Seg[] }

const area = (r: RoomSpec): number => r.w * r.h;
/** A room's length along a module: its floor over the module's width, three at least (a gun bay five, for its mounts). */
const lengthOf = (r: RoomSpec): number => Math.max(r.role === 'weapons' ? 5 : 3, Math.ceil(area(r) / PREFAB_WIDE));
const segsOf = (rooms: readonly RoomSpec[]): Seg[] => rooms.flatMap((r) => [{ spec: r, len: lengthOf(r) }, ...(r.annex ? [{ spec: { ...r.annex }, len: lengthOf(r.annex), annexed: true }] : [])]);
const run = (segs: readonly Seg[]): number => segs.reduce((n, s) => n + s.len + 1, -1);
const ROOM_ORDER: RoomRole[] = ['core', 'shields', 'reactor', 'industry'];
/** Rooms in the order one walks into them: the core before the reactors, the workshop before the hold. */
const ordered = (rooms: readonly RoomSpec[]): RoomSpec[] => {
  const rank = (r: RoomSpec): number => { const i = ROOM_ORDER.indexOf(r.role); return i < 0 ? ROOM_ORDER.length : i; };
  return [...rooms].sort((a, b) => rank(a) - rank(b));
};

export interface Prefab { why: string; pads?: Box[] }

export function prefab(c: Ctx, rooms: readonly RoomSpec[], docks: readonly RoomSpec[], cabins: readonly RoomSpec[]): Prefab {
  const g = c.g, taken = new Set<RoomSpec>();
  const pick = (p: (r: RoomSpec) => boolean): RoomSpec[] => { const out = rooms.filter((r) => !taken.has(r) && p(r)); for (const r of out) taken.add(r); return out; };
  // The departments, module by module.
  const office = pick((r) => r.role === 'bridge' && r.dept === 'harbour'), armoury = pick((r) => r.role === 'armoury');
  const guns = pick((r) => r.role === 'weapons');
  const market = pick((r) => r.dept === 'market');
  const beds = [...pick((r) => r.role === 'quarters' && r.dept !== 'harbour'), ...pick((r) => r.role === 'quarters'), ...cabins];
  const mess = pick((r) => r.dept === 'commons');
  const medical = pick((r) => r.dept === 'habitation');
  const command = ordered(pick((r) => r.dept === 'secure' || r.role === 'bridge'));
  const stores = ordered(pick(() => true));
  // A market room ahead of the stalls: the trading floor (not in the programme; it stands for the market itself).
  const floor: RoomSpec = { role: 'plaza', dept: 'market', mods: [], w: PREFAB_WIDE, h: PREFAB_WIDE };

  const placed: Module[] = [];
  const clear = (b: Box, host?: Module): boolean => {
    // Two tiles of ground at least to every other module (but the one it is joined to), and nothing reserved.
    for (const m of placed) if (m !== host && b[0] < m.box[2] + 2 && m.box[0] < b[2] + 2 && b[1] < m.box[3] + 2 && m.box[1] < b[3] + 2) return false;
    for (let y = b[1]; y < b[3]; y++) for (let x = b[0]; x < b[2]; x++) if (!c.free(x, y) && !(host && y === b[1])) return false;
    return true;
  };
  /**
   * A module whose outer box starts at (x, y), running east ('h') or south ('v'), its rooms in the order one walks in:
   * from its west or north end, or with `rev` from its east end. `host`: the module it grows out of (the stem of a T),
   * sharing that one's wall; its near corners stay square. Null when the ground is taken.
   */
  const module = (x: number, y: number, dir: 'h' | 'v', segs: Seg[], rev = false, host?: Module): Module | null => {
    const L = run(segs), box: Box = dir === 'h' ? [x, y, x + L + 2, y + OUT] : [x, y, x + OUT, y + L + 2];
    if (segs.length === 0 || !clear(box, host)) return null;
    g.rect(SOLID, ...box);
    let o = 1, before = -1;
    for (const [i, s] of segs.entries()) {
      const id = s.hall ?? g.room(s.spec?.role ?? 'hall', { spec: { ...(s.spec as RoomSpec), w: s.len, h: PREFAB_WIDE }, doors: 0, access: s.annexed && before >= 0 ? [before] : [] });
      const a = rev ? L + 2 - o - s.len : o;
      g.rect(id, ...(dir === 'h' ? [x + a, y + 1, x + a + s.len, y + 1 + PREFAB_WIDE] : [x + 1, y + a, x + 1 + PREFAB_WIDE, y + a + s.len]) as Box);
      if (!s.annexed) before = id;
      // A door in the partition after it (toward the far end), at its middle.
      const p = rev ? a - 1 : a + s.len;
      if (i < segs.length - 1) g.gate(...(dir === 'h' ? [x + p, y + 1 + (PREFAB_WIDE >> 1)] : [x + 1 + (PREFAB_WIDE >> 1), y + p]) as [number, number]);
      o += s.len + 1;
    }
    // The corners cut: the corner tile open, the floor's corner tile wall.
    for (const [cx, cy, dx, dy] of [[box[0], box[1], 1, 1], [box[2] - 1, box[1], -1, 1], [box[0], box[3] - 1, 1, -1], [box[2] - 1, box[3] - 1, -1, -1]] as const) {
      if (host && cy === box[1]) continue;
      g.set(cx, cy, SPACE);
      g.set(cx + dx, cy + dy, SOLID);
    }
    const m = { box, dir, segs };
    placed.push(m);
    return m;
  };
  /** A tube from a module wall tile at (x, y) running `d` (dx, dy) to the next module's wall: floor, its walls, a door at each end. */
  const tube = (x: number, y: number, dx: number, dy: number): void => {
    const hall = g.hall('hall', 'commons');
    for (let k = 1; k <= TUBE; k++) {
      const tx = x + dx * k, ty = y + dy * k;
      g.set(tx - dy, ty - dx, SOLID);
      g.set(tx + dy, ty + dx, SOLID);
      g.set(tx, ty, hall);
    }
    g.gate(x, y);
    g.gate(x + dx * (TUBE + 1), y + dy * (TUBE + 1));
  };
  /** Where segment `i` of a module starts along it (x of a horizontal one's floor, y of a vertical one's). */
  const start = (m: Module, i: number): number => m.segs.slice(0, i).reduce((n, s) => n + s.len + 1, 1) + (m.dir === 'h' ? m.box[0] : m.box[1]);

  // The entry, its outer wall north: office | arrivals | armoury, an airlock under each pad in arrivals' outer wall.
  const n = Math.min(PREFAB_PADS, docks.length), ARR = Math.max(5 + (PAD + 3) * (n - 1), OUT);
  const arrivals = g.hall('hall', 'harbour'), offSegs = segsOf(office);
  const bar = module(0, 0, 'h', [...offSegs, { hall: arrivals, len: ARR }, ...segsOf(armoury)]);
  if (!bar) return { why: 'no ground for the entry' };
  const a0 = start(bar, offSegs.length), pads: Box[] = [];
  for (const [i, d] of docks.slice(0, n).entries()) {
    const hx = a0 + 2 + i * (PAD + 3);
    g.rect(g.hall('dock', 'airlock', { ...d, w: 3, h: 3 }), hx - 1, 1, hx + 2, 4);
    g.gate(hx, 0);
    // Its pad on the ground outside, the hatch at the middle of the pad's near edge.
    const pad: Box = [hx - (PAD >> 1), -PAD, hx + (PAD >> 1) + 1, 0];
    for (let y = pad[1]; y < pad[3]; y++) for (let x = pad[0]; x < pad[2]; x++) { if (!c.free(x, y)) return { why: 'no ground for a pad' }; c.reserved.add(key(x, y)); }
    pads.push(pad);
  }
  // Customs: the stem of the T, down from arrivals' middle.
  const mc = a0 + (ARR >> 1), customs = g.hall('plaza', 'customs');
  const stem = module(mc - 1 - (PREFAB_WIDE >> 1), bar.box[3] - 1, 'v', [{ hall: customs, len: CUSTOMS }], false, bar);
  if (!stem) return { why: 'no ground for customs' };
  g.gate(mc, bar.box[3] - 1);
  // The junctions down from customs, a department module either side of each: the pair of each row turned whichever way
  // keeps the base narrowest.
  const rows = ([[[floor, ...market], mess], [stores, beds], [command, medical]] as RoomSpec[][][]).map((r) => r.map(segsOf)).filter((r) => r.some((s) => s.length > 0));
  const len = (s: Seg[]): number => (s.length > 0 ? run(s) + 2 : 0);
  let flip = 0, best = Infinity;
  for (let f = 0; f < 1 << rows.length; f++) {
    const side = (k: 0 | 1): number => Math.max(0, ...rows.map((r, i) => len(r[((f >> i) & 1) ^ k] as Seg[])));
    if (side(0) + side(1) < best) [best, flip] = [side(0) + side(1), f];
  }
  let above: Module = stem;
  for (const [i, r] of rows.entries()) {
    const j = module(above.box[0], above.box[3] + TUBE, 'v', [{ hall: g.hall('hall', 'commons'), len: PREFAB_WIDE }]);
    if (!j) return { why: 'no ground for a junction' };
    tube(mc, above.box[3] - 1, 0, 1);
    above = j;
    const row = j.box[1] + 1 + (PREFAB_WIDE >> 1), [west, east] = (flip >> i) & 1 ? [r[1], r[0]] : [r[0], r[1]];
    if (west && west.length > 0) {
      if (!module(j.box[0] - TUBE - len(west), j.box[1], 'h', west, true)) return { why: 'no ground for a module west' };
      tube(j.box[0], row, -1, 0);
    }
    if (east && east.length > 0) {
      if (!module(j.box[2] + TUBE, j.box[1], 'h', east)) return { why: 'no ground for a module east' };
      tube(j.box[2] - 1, row, 1, 0);
    }
  }
  // The guns off the last junction's far end, all in one module.
  if (guns.length > 0) {
    if (!module(above.box[0], above.box[3] + TUBE, 'v', segsOf(guns))) return { why: 'no ground for the guns' };
    tube(mc, above.box[3] - 1, 0, 1);
  }
  return { why: '', pads };
}
