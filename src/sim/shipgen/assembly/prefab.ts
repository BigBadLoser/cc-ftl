import type { RoomSpec } from '../plan';
import type { RoomRole } from '../types';
import type { Ctx } from './model';
import { key } from './model';
import { SOLID, SPACE } from './regions';

/**
 * A prefab base on open ground (the asteroid trading outpost's; mock sheet "prefab-zoned", issue #508): the station as
 * separate modules standing on levelled rock, joined by short tubes, the ground between them open.
 *   module  one standard prefab: seven tiles inside (nine with its walls), its corners cut, a straight run of rooms
 *           along it, a partition with a door between each on its centre line; as long as its rooms' floor needs
 *   tube    one tile wide inside, three long, straight, on the centre lines of the two modules it joins
 * Every width is odd, so tubes and doors sit on centre lines. The public rooms are the junctions; there are no empty halls.
 *   visitors' side  two landing pads either side of arrivals, an airlock in each of its side walls; arrivals stands on
 *                   customs (office and armoury off its ends, dead ends); a tube to the market hall (trade is done there,
 *                   no stalls), the warehouse off its side
 *   crew side       through the crew door, the mess: the crew hub, the pantry built onto its far end, the departments off
 *                   its long sides in pairs, symmetric about its middle
 * A department is a branch: its front room on the tube, walked through only within the department (medbay, trauma;
 * barracks, barracks, the chief's cabin; fire control, core, shields, reactors; workshop, ore store). Some branches
 * turn down off their tube (an L), chosen per seed from tidy patterns. No gun rooms: the guns would be turrets out on
 * the ground worked from fire control, which the sim cannot stand yet (a module on ground outside the hull belongs to
 * no ship). Painted solid first, floor cut out, so every wall is one tile; a cut corner is a stair of wall (the seal
 * rule allows no floor diagonal to space, so the floor's corner tile is wall too).
 */

/** Tiles inside a module, across it. */
export const PREFAB_WIDE = 7;
/** Landing pads, each with its airlock: the airlocks a prefab base has. */
export const PREFAB_PADS = 2;
/** A module's outer width; floor tiles in a tube, wall to wall (the ground between two modules it joins). */
const OUT = PREFAB_WIDE + 2, TUBE = 3;
/** A landing pad's side, and the ground between it and its airlock's wall (the collar and one more). */
const PAD = 9, APRON = 2;
/** Arrivals' length (it stands on customs, as long as a module is wide); the market hall and the mess, inside. */
const ARRIVALS = 9, MARKET: [number, number] = [9, 11], MESS_WIDE = 11;
/** Between two branches off one side of the mess. */
const PITCH = OUT + TUBE;

type Box = [number, number, number, number];
interface Seg { spec?: RoomSpec; hall?: number; len: number; annexed?: boolean; access?: number[] }
interface Module { box: Box; dir: 'h' | 'v'; segs: Seg[]; ids: number[] }
interface Opts { rev?: boolean; wide?: number; host?: { m: Module; row: number } }

const area = (r: RoomSpec): number => r.w * r.h;
/** A room's length along a module: its floor over the module's width, three at least. */
const lengthOf = (r: RoomSpec): number => Math.max(3, Math.ceil(area(r) / PREFAB_WIDE));
const segsOf = (rooms: readonly RoomSpec[]): Seg[] => rooms.flatMap((r) => [{ spec: r, len: lengthOf(r) }, ...(r.annex ? [{ spec: { ...r.annex }, len: lengthOf(r.annex), annexed: true }] : [])]);
const run = (segs: readonly Seg[]): number => segs.reduce((n, s) => n + s.len + 1, -1);
const ROOM_ORDER: RoomRole[] = ['bridge', 'core', 'shields', 'reactor', 'industry', 'cargo'];
/** Rooms in the order one walks into them: fire control, the core, then the reactors; the workshop before the ore store. */
const ordered = (rooms: readonly RoomSpec[]): RoomSpec[] => {
  const rank = (r: RoomSpec): number => { const i = ROOM_ORDER.indexOf(r.role); return i < 0 ? ROOM_ORDER.length : i; };
  return [...rooms].sort((a, b) => rank(a) - rank(b));
};
const FIRE = 'module.weaponsConsole', ORE = 'module.storage_ore';
/** The market hall: trade counters and benches. */
const TRADE: string[] = ['module.console', 'module.console', 'module.bench', 'module.bench'];

export interface Prefab { why: string; pads?: Box[] }

export function prefab(c: Ctx, rooms: readonly RoomSpec[], docks: readonly RoomSpec[], cabins: readonly RoomSpec[]): Prefab {
  const g = c.g, taken = new Set<RoomSpec>();
  const pick = (p: (r: RoomSpec) => boolean): RoomSpec[] => { const out = rooms.filter((r) => !taken.has(r) && p(r)); for (const r of out) taken.add(r); return out; };
  // The departments. Fire control takes the office's weapons console.
  const desk = pick((r) => r.role === 'bridge' && r.dept === 'harbour'), armoury = pick((r) => r.role === 'armoury');
  const office = desk.map((r) => ({ ...r, mods: r.mods.filter((m) => m !== FIRE) }));
  const fire: RoomSpec = { role: 'bridge', dept: 'secure', mods: desk.flatMap((r) => r.mods.filter((m) => m === FIRE)), w: 5, h: PREFAB_WIDE };
  const beds = [...pick((r) => r.role === 'quarters' && r.dept !== 'harbour'), ...pick((r) => r.role === 'quarters'), ...cabins];
  const [mess, ...commons] = pick((r) => r.dept === 'commons');
  const medical = pick((r) => r.dept === 'habitation');
  const command = ordered([fire, ...pick((r) => r.dept === 'secure' || r.role === 'bridge')]);
  const warehouse = pick((r) => r.dept === 'freight');
  // The ore store: not in the programme (the workshop's raw stock, in ore bins).
  const oreStore: RoomSpec = { role: 'cargo', dept: 'works', mods: Array<string>(4).fill(ORE), w: 6, h: PREFAB_WIDE };
  const works = [...ordered(pick(() => true)), oreStore, ...commons];

  const placed: Module[] = [];
  const clear = (b: Box, host?: Opts['host']): boolean => {
    // Two tiles of ground at least to every other module (but the one it is built onto), and nothing reserved.
    for (const m of placed) if (m !== host?.m && b[0] < m.box[2] + 2 && m.box[0] < b[2] + 2 && b[1] < m.box[3] + 2 && m.box[1] < b[3] + 2) return false;
    for (let y = b[1]; y < b[3]; y++) for (let x = b[0]; x < b[2]; x++) if (!c.free(x, y) && y !== host?.row) return false;
    return true;
  };
  /**
   * A module whose outer box starts at (x, y), running east ('h') or south ('v'), its rooms in the order one walks in:
   * from its west or north end, or with `rev` from its east or south end. `host`: the module it is built onto, sharing
   * that one's wall on `row`, where its corners stay square. Null when the ground is taken.
   */
  const module = (x: number, y: number, dir: 'h' | 'v', segs: Seg[], o: Opts = {}): Module | null => {
    const wide = o.wide ?? PREFAB_WIDE, L = run(segs), box: Box = dir === 'h' ? [x, y, x + L + 2, y + wide + 2] : [x, y, x + wide + 2, y + L + 2];
    if (segs.length === 0 || !clear(box, o.host)) return null;
    g.rect(SOLID, ...box);
    const ids: number[] = [];
    let at = 1, before = -1;
    for (const [i, s] of segs.entries()) {
      const id = s.hall ?? g.room(s.spec?.role ?? 'hall', { spec: { ...(s.spec as RoomSpec), w: s.len, h: wide }, doors: 0, access: s.access ?? (s.annexed && before >= 0 ? [before] : []) });
      ids.push(id);
      const a = o.rev ? L + 2 - at - s.len : at;
      g.rect(id, ...(dir === 'h' ? [x + a, y + 1, x + a + s.len, y + 1 + wide] : [x + 1, y + a, x + 1 + wide, y + a + s.len]) as Box);
      if (!s.annexed) before = id;
      // A door in the partition after it (toward the far end), on the centre line.
      const p = o.rev ? a - 1 : a + s.len;
      if (i < segs.length - 1) g.gate(...(dir === 'h' ? [x + p, y + 1 + (wide >> 1)] : [x + 1 + (wide >> 1), y + p]) as [number, number]);
      at += s.len + 1;
    }
    // The corners cut: the corner tile open, the floor's corner tile wall.
    for (const [cx, cy, dx, dy] of [[box[0], box[1], 1, 1], [box[2] - 1, box[1], -1, 1], [box[0], box[3] - 1, 1, -1], [box[2] - 1, box[3] - 1, -1, -1]] as const) {
      if (cy === o.host?.row) continue;
      g.set(cx, cy, SPACE);
      g.set(cx + dx, cy + dy, SOLID);
    }
    const m = { box, dir, segs, ids };
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
  /** A module off the side of a hub at row `y`: west (its rooms from its east end) or east. */
  const side = (hub: Module, y: number, west: boolean, segs: Seg[]): Module | null => {
    const m = module(west ? hub.box[0] - TUBE - run(segs) - 2 : hub.box[2] + TUBE, y - (OUT >> 1), 'h', segs, { rev: west });
    if (m) tube(west ? hub.box[0] : hub.box[2] - 1, y, west ? -1 : 1, 0);
    return m;
  };

  // Customs, office and armoury off its ends; arrivals built onto it, an airlock in each side wall over a pad.
  const offSegs = segsOf(office), customs = g.hall('plaza', 'customs');
  const bar = module(0, 0, 'h', [...offSegs, { hall: customs, len: PREFAB_WIDE }, ...segsOf(armoury)]);
  if (!bar) return { why: 'no ground for customs' };
  const mc = start(bar, offSegs.length) + (PREFAB_WIDE >> 1);
  const arr = module(mc - (OUT >> 1), bar.box[1] - ARRIVALS - 1, 'v', [{ hall: g.hall('hall', 'harbour'), len: ARRIVALS }], { host: { m: bar, row: bar.box[1] } });
  if (!arr) return { why: 'no ground for arrivals' };
  g.gate(mc, bar.box[1]);
  const pads: Box[] = [], hy = arr.box[1] + 1 + (ARRIVALS >> 1);
  for (const [i, d] of docks.slice(0, PREFAB_PADS).entries()) {
    const west = i === 0, wx = west ? arr.box[0] : arr.box[2] - 1, ax = west ? wx + 1 : wx - 3;
    g.rect(g.hall('dock', 'airlock', { ...d, w: 3, h: 3 }), ax, hy - 1, ax + 3, hy + 2);
    g.gate(wx, hy);
    const px = west ? wx - APRON - PAD : wx + APRON + 1, pad: Box = [px, hy - (PAD >> 1), px + PAD, hy + (PAD >> 1) + 1];
    for (let y = pad[1]; y < pad[3]; y++) for (let x = pad[0]; x < pad[2]; x++) { if (!c.free(x, y)) return { why: 'no ground for a pad' }; c.reserved.add(key(x, y)); }
    pads.push(pad);
  }
  // The market hall down from customs, the warehouse off one side.
  const trade: RoomSpec = { role: 'plaza', dept: 'market', mods: TRADE, w: MARKET[0], h: MARKET[1] };
  const market = module(mc - 1 - (MARKET[0] >> 1), bar.box[3] + TUBE, 'v', [{ spec: trade, len: MARKET[1] }], { wide: MARKET[0] });
  if (!market) return { why: 'no ground for the market' };
  tube(mc, bar.box[3] - 1, 0, 1);
  if (warehouse.length > 0 && !side(market, market.box[1] + 1 + (MARKET[1] >> 1), c.rng.int(0, 1) === 0, segsOf(warehouse))) return { why: 'no ground for the warehouse' };
  // The crew door to the mess, the branches off its long sides in pairs: the longest pair on one side (each side's
  // longer branch in its lower slot), centred on the mess's middle; the mess as long as its longer side needs.
  const branches = [medical, beds, command, works].map(segsOf).filter((s) => s.length > 0).sort((a, b) => run(b) - run(a));
  const pairs = [branches.slice(0, 2), branches.slice(2, 4)].map((p) => [...p].reverse()), k = Math.max(1, ...pairs.map((p) => p.length));
  const L = k * PITCH - TUBE;
  const messRoom: RoomSpec | undefined = mess ? { ...mess } : undefined;
  if (messRoom) delete messRoom.annex;
  const hub = module(mc - 1 - (MESS_WIDE >> 1), market.box[3] + TUBE, 'v', [messRoom ? { spec: messRoom, len: L } : { hall: g.hall('plaza', 'commons'), len: L }], { wide: MESS_WIDE });
  if (!hub) return { why: 'no ground for the mess' };
  tube(mc, market.box[3] - 1, 0, 1);
  if (mess?.annex) {
    const row = hub.box[3] - 1;
    if (!module(mc - (OUT >> 1), row, 'v', [{ spec: { ...mess.annex }, len: lengthOf(mess.annex), access: [hub.ids[0] as number] }], { host: { m: hub, row } })) return { why: 'no ground for the pantry' };
    g.gate(mc, row);
  }
  // Tidy turns: none, every lower branch turned down, or only the longest.
  const turn = c.rng.pick(['none', 'lower', 'longest'] as const), firstWest = c.rng.int(0, 1) === 0;
  for (const [s, pair] of pairs.entries()) {
    const west = (s === 0) === firstWest;
    for (const [i, segs] of pair.entries()) {
      const y = hub.box[1] + 1 + (k - pair.length) * (PITCH >> 1) + i * PITCH + (OUT >> 1);
      const lower = pair.length === k && k > 1 && i === k - 1;
      if (lower && (turn === 'lower' || (turn === 'longest' && s === 0))) {
        // Down off its tube: the front room square on the tube, the rest running south.
        const down = [{ ...(segs[0] as Seg), len: Math.max((segs[0] as Seg).len, PREFAB_WIDE) }, ...segs.slice(1)];
        if (module(west ? hub.box[0] - TUBE - OUT : hub.box[2] + TUBE, y - (OUT >> 1), 'v', down)) { tube(west ? hub.box[0] : hub.box[2] - 1, y, west ? -1 : 1, 0); continue; }
      }
      if (!side(hub, y, west, segs)) return { why: 'no ground for a branch' };
    }
  }
  return { why: '', pads };
}
