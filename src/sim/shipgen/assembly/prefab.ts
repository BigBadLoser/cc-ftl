import type { RoomSpec } from '../plan';
import type { RoomRole } from '../types';
import type { Ctx } from './model';
import type { PrefabPlan } from './recipe';
import { key } from './model';
import { SOLID, SPACE } from './regions';
import { holdDepth } from '../rooms/rules/plant';

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
 * barracks, barracks, the chief's cabin; workshop, ore store). Command is a hub of its own in a lower slot: the command
 * room (the consoles; no helm), the core and the shields in one split pod down a tube off its outer side, the reactors
 * (one room) off its far end. Some branches turn down off their tube (an L), per seed, where they fit. The warehouse
 * is as long as its crates need. No gun rooms: the guns and the point defence are turrets out on the ground, worked
 * from the command room and cabled to the hull (`groundTurrets`, shipgen/groundTurrets.ts). Painted solid first, floor cut out, so every wall is one tile; a cut corner is a stair of wall (the seal
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
const ARRIVALS = 9, MESS_WIDE = 11;
/** The market hall (wide, long): the trading post's court; the small trade hall of a farm or a mine. */
const MARKET: [number, number] = [9, 11], TRADE_HALL: [number, number] = [7, 9];
/** The long tube out to a compound on the ground, and the pitch of ribs hung side by side (a module and two tiles of ground). */
const LONG = 5, RIB = OUT + 2;
/** A greenhouse's length (long and narrow), and an ore store's side; the lobby before an outside airlock. */
const HUB = 13, HOUSE = 15, ORES: [number, number] = [11, 7], LOBBY = 4, CLUSTER = 5;
/** The command room's length (its programme floor, nine by seven). */
const CMD = 9;
/** Between two branches off one side of the mess. */
const PITCH = OUT + TUBE;

type Box = [number, number, number, number];
/** A room along a module. */
interface Seg { spec?: RoomSpec; hall?: number; len: number; annexed?: boolean; access?: number[] }
/** A module as built: its box, its rooms' region ids and where each runs along it (x of a horizontal one, y of a vertical). */
interface Module { box: Box; dir: 'h' | 'v'; segs: Seg[]; ids: number[]; spans: [number, number][] }
/**
 * `host`: the module it is built onto, sharing that one's wall on `row`, where its corners stay square; `square`: a row
 * of its box whose corners stay square (another module is built onto that wall).
 */
interface Opts { rev?: boolean; wide?: number; host?: { m: Module; row: number }; square?: number }

const area = (r: RoomSpec): number => r.w * r.h;
/** A room's length along a module: its floor over the module's width, three at least. */
const lengthOf = (r: RoomSpec): number => Math.max(3, Math.ceil(area(r) / PREFAB_WIDE));
const segsOf = (rooms: readonly RoomSpec[]): Seg[] => rooms.flatMap((r) => [{ spec: r, len: lengthOf(r) }, ...(r.annex ? [{ spec: { ...r.annex }, len: lengthOf(r.annex), annexed: true }] : [])]);
const run = (segs: readonly Seg[]): number => segs.reduce((n, s) => n + s.len + 1, -1);
const ROOM_ORDER: RoomRole[] = ['bridge', 'core', 'shields', 'reactor', 'industry', 'cargo'];
/** Rooms in the order one walks into them: the core before the shields and reactors; the workshop before the ore store. */
const ordered = (rooms: readonly RoomSpec[]): RoomSpec[] => {
  const rank = (r: RoomSpec): number => { const i = ROOM_ORDER.indexOf(r.role); return i < 0 ? ROOM_ORDER.length : i; };
  return [...rooms].sort((a, b) => rank(a) - rank(b));
};
const CONSOLES: readonly string[] = ['module.weaponsConsole', 'module.shieldConsole'], ORE = 'module.storage_ore_large', CRATE = 'module.storage', COLD = 'module.storage_cold';
/** The market hall: trade counters and benches. */
const TRADE: string[] = ['module.console', 'module.console', 'module.bench', 'module.bench'];

/** One reactor room for these: two rows down the long walls (2 wide each, a gap of 3 for the batteries between), a tile spare. */
const reactorRoom = (rooms: readonly RoomSpec[]): RoomSpec => {
  const mods = rooms.flatMap((r) => r.mods), n = mods.filter((m) => m === 'module.reactor').length, bats = mods.filter((m) => m === 'module.battery').length;
  const per = Math.max(1, Math.ceil(n / 2)), len = Math.max(8, per * 2 + (per - 1) * 3 + 1, Math.ceil(((4 * n + bats) * 2) / PREFAB_WIDE));
  return { ...(rooms[0] as RoomSpec), mods, w: len, h: PREFAB_WIDE };
};

export interface Prefab { why: string; pads?: Box[] }

/** A branch off the mess: rooms in a row (`segs`), the command block, or a builder of its own (`build`, needs a lower slot). */
interface Leg { len: number; segs?: Seg[]; command?: boolean; build?: (y: number, west: boolean) => boolean; low?: boolean }
/** A place on the mess's long sides: the side, the row among that side's, and whether the row is the upper or the lower. */
interface Slot { west: boolean; row: number; size: number; up: boolean; low: boolean }

export function prefab(c: Ctx, rooms: readonly RoomSpec[], docks: readonly RoomSpec[], cabins: readonly RoomSpec[], plan: PrefabPlan = 'trade'): Prefab {
  const g = c.g, taken = new Set<RoomSpec>();
  const trade = plan === 'trade', farming = plan === 'farmRows' || plan === 'farmCluster';
  const pick = (p: (r: RoomSpec) => boolean): RoomSpec[] => { const out = rooms.filter((r) => !taken.has(r) && p(r)); for (const r of out) taken.add(r); return out; };
  // The departments. The station's bridge consoles go to the command room on the crew side (no helm: a base does not
  // fly); the harbour office keeps a desk (its rule's own furniture).
  const desk = pick((r) => r.role === 'bridge' && r.dept === 'harbour'), armoury = pick((r) => r.role === 'armoury');
  const office = desk.map((r) => ({ ...r, mods: [] }));
  const commandRoom: RoomSpec = { role: 'bridge', dept: 'secure', mods: desk.flatMap((r) => r.mods.filter((m) => CONSOLES.includes(m))), w: CMD, h: PREFAB_WIDE };
  const beds = [...pick((r) => r.role === 'quarters' && r.dept !== 'harbour'), ...pick((r) => r.role === 'quarters'), ...cabins];
  const [mess, ...commons] = pick((r) => r.dept === 'commons');
  // The ward with its trauma room (a farm or a mine has too few crew for the programme's).
  const ward = pick((r) => r.dept === 'habitation');
  const trauma: RoomSpec = { ...(ward[0] as RoomSpec), mods: ['module.recovery', 'module.med_bed'], w: 5, h: 4 };
  delete trauma.annex;
  const medical = ward.length > 0 && !trade && !ward.some((r) => r.annex) ? [{ ...(ward[0] as RoomSpec), annex: trauma }, ...ward.slice(1)] : ward;
  const secure = ordered(pick((r) => r.dept === 'secure' || r.role === 'bridge')), wings = secure.filter((r) => r.role !== 'reactor');
  // The reactors in one room, as long as they need (down both long walls, batteries in the gaps), not the programme's floor.
  const reactors = secure.filter((r) => r.role === 'reactor');
  const plant: RoomSpec[] = reactors.length > 0 ? [reactorRoom(reactors)] : [];
  // The warehouse as deep as its crates need (the programme's floor for it is the old crate rooms', roomy for a module).
  const warehouse: Seg[] = pick((r) => r.dept === 'freight').map((r) => !trade ? { ...r, mods: r.mods.map((m) => (m === COLD ? CRATE : m)) } : r).map((r) => ({ spec: r, len: r.mods.includes(CRATE) ? holdDepth(r.mods.filter((m) => m === CRATE).length, PREFAB_WIDE) : lengthOf(r) }));
  // The ore store: not in the programme (the workshop's raw stock, in ore bins). A farm has none.
  const oreStore: RoomSpec = { role: 'cargo', dept: 'works', mods: Array<string>(6).fill(ORE), w: ORES[0], h: ORES[1] };
  const rest = ordered(pick(() => true));
  const refinery = (r: RoomSpec): boolean => r.mods.includes('module.refinery');
  // The works, by kind: greenhouses, the refinery, the pod bay with its suit room, the ore stores, the workshop; the rest joins the medbay's branch.
  const farms = trade ? [] : rest.filter((r) => r.role === 'farm'), refineries = trade ? [] : rest.filter(refinery);
  const pods = trade ? [] : rest.filter((r) => r.role === 'hangar'), shop = trade ? [] : rest.filter((r) => r.role === 'industry' && !refinery(r));
  // The ore stores all alike: four large bins in a square room.
  const oreRooms = trade || farming ? [] : [...rest.filter((r) => r.role === 'cargo'), oreStore].map((r) => ({ ...r, mods: oreStore.mods, w: ORES[0], h: ORES[1] }));
  const used = new Set<RoomSpec>([...farms, ...refineries, ...pods, ...shop, ...rest.filter((r) => r.role === 'cargo' && !trade && !farming)]);
  const works = trade ? [...ordered(rest), oreStore, ...commons] : [];
  const extra = trade ? [] : [...rest.filter((r) => !used.has(r)), ...commons];

  const placed: Module[] = [];
  const clear = (b: Box, host?: Opts['host']): boolean => {
    // Two tiles of ground at least to every other module (but the one it is built onto), and nothing reserved.
    for (const m of placed) if (m !== host?.m && b[0] < m.box[2] + 2 && m.box[0] < b[2] + 2 && b[1] < m.box[3] + 2 && m.box[1] < b[3] + 2) return false;
    for (let y = b[1]; y < b[3]; y++) for (let x = b[0]; x < b[2]; x++) if (!c.free(x, y) && y !== host?.row) return false;
    return true;
  };
  /**
   * A module whose outer box starts at (x, y), running east ('h') or south ('v'), its rooms in the order one walks in:
   * from its west or north end, or with `rev` from its east or south end. `host`: the module it is built onto (Opts).
   * Null when the ground is taken.
   */
  const module = (x: number, y: number, dir: 'h' | 'v', segs: Seg[], o: Opts = {}): Module | null => {
    const wide = o.wide ?? PREFAB_WIDE, L = run(segs), box: Box = dir === 'h' ? [x, y, x + L + 2, y + wide + 2] : [x, y, x + wide + 2, y + L + 2];
    if (segs.length === 0 || !clear(box, o.host)) return null;
    g.rect(SOLID, ...box);
    const ids: number[] = [], spans: [number, number][] = [];
    let at = 1, before = -1;
    for (const [i, s] of segs.entries()) {
      const id = s.hall ?? g.room(s.spec?.role ?? 'hall', { spec: { ...(s.spec as RoomSpec), w: s.len, h: wide }, doors: 0, access: s.access ?? (s.annexed && before >= 0 ? [before] : []) });
      ids.push(id);
      const a = o.rev ? L + 2 - at - s.len : at;
      g.rect(id, ...(dir === 'h' ? [x + a, y + 1, x + a + s.len, y + 1 + wide] : [x + 1, y + a, x + 1 + wide, y + a + s.len]) as Box);
      spans.push(dir === 'h' ? [x + a, x + a + s.len] : [y + a, y + a + s.len]);
      if (!s.annexed) before = id;
      // A door in the partition after it (toward the far end), on the centre line.
      const p = o.rev ? a - 1 : a + s.len;
      if (i < segs.length - 1) g.gate(...(dir === 'h' ? [x + p, y + 1 + (wide >> 1)] : [x + 1 + (wide >> 1), y + p]) as [number, number]);
      at += s.len + 1;
    }
    // The corners cut: the corner tile open, the floor's corner tile wall.
    for (const [cx, cy, dx, dy] of [[box[0], box[1], 1, 1], [box[2] - 1, box[1], -1, 1], [box[0], box[3] - 1, 1, -1], [box[2] - 1, box[3] - 1, -1, -1]] as const) {
      if (cy === o.host?.row || cy === o.square) continue;
      g.set(cx, cy, SPACE);
      g.set(cx + dx, cy + dy, SOLID);
    }
    const m = { box, dir, segs, ids, spans };
    placed.push(m);
    return m;
  };
  /** A tube from a module wall tile at (x, y) running `d` (dx, dy) to the next module's wall: floor, its walls, a door at each end. */
  const tube = (x: number, y: number, dx: number, dy: number, len = TUBE): void => {
    const hall = g.hall('hall', 'commons');
    for (let k = 1; k <= len; k++) {
      const tx = x + dx * k, ty = y + dy * k;
      g.set(tx - dy, ty - dx, SOLID);
      g.set(tx + dy, ty + dx, SOLID);
      g.set(tx, ty, hall);
    }
    g.gate(x, y);
    g.gate(x + dx * (len + 1), y + dy * (len + 1));
  };
  /** A module off the side of a module at row `y`: west (its rooms from its east end) or east; `gap` tiles of tube. */
  const side = (hub: Module, y: number, west: boolean, segs: Seg[], gap = TUBE, wide = PREFAB_WIDE): Module | null => {
    const half = (wide + 2) >> 1, m = module(west ? hub.box[0] - gap - run(segs) - 2 : hub.box[2] + gap, y - half, 'h', segs, { rev: west, wide });
    if (m) tube(west ? hub.box[0] : hub.box[2] - 1, y, west ? -1 : 1, 0, gap);
    return m;
  };
  /** A module hung below `m`, centred on column `x` of its south wall, one tube down. */
  const below = (m: Module, x: number, segs: Seg[], wide = PREFAB_WIDE): Module | null => {
    const r = module(x - ((wide + 2) >> 1), m.box[3] + TUBE, 'v', segs, { wide });
    if (r) tube(x, m.box[3] - 1, 0, 1);
    return r;
  };
  /**
   * An airlock for a base's crew (no pad) out of the end of a horizontal module: its last room is a lobby, a hall
   * `LOBBY` long, and the 3x3 unit stands in it against the end wall, its hatch in that wall onto the open ground.
   */
  const lobby = (): Seg => ({ hall: g.hall('hall', 'commons'), len: LOBBY });
  const lock = (m: Module, east: boolean): void => {
    const d = docks[0];
    if (!d) return;
    const cy = m.box[1] + 1 + (PREFAB_WIDE >> 1), wx = east ? m.box[2] - 1 : m.box[0], ax = east ? wx - 3 : wx + 1;
    g.rect(g.hall('dock', 'airlock', { ...d, w: 3, h: 3 }), ax, cy - 1, ax + 3, cy + 2);
    g.gate(wx, cy);
  };
  /** The last room of a run at least `n` long (a unit carved in it leaves room), and the run at least `need` altogether. */
  const padded = (segs: Seg[], n: number, need = 0): Seg[] => segs.map((s, i) => (i === segs.length - 1 ? { ...s, len: Math.max(s.len, n, need - run(segs) + s.len) } : s));

  // Customs, office and armoury off its ends; arrivals built onto it, an airlock in each side wall over a pad.
  const offSegs = segsOf(office), customs = g.hall('plaza', 'customs');
  const bar = module(0, 0, 'h', [...offSegs, { hall: customs, len: PREFAB_WIDE }, ...segsOf(armoury)]);
  if (!bar) return { why: 'no ground for customs' };
  const mc = offSegs.reduce((n, s) => n + s.len + 1, 1) + bar.box[0] + (PREFAB_WIDE >> 1);
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

  // The branches off the mess's long sides, in slots centred on its middle: what each is, and where it stands (the seed
  // mirrors the sides and swaps the departments between the slots), before anything that depends on it is built.
  let mess_: Module | null = null;
  const hubOf = (): Module => mess_ as Module;
  const legs: Leg[] = [];
  const row = (segs: Seg[]): void => { if (segs.length > 0) legs.push({ segs, len: run(segs) }); };
  const wing = (b: (y: number, west: boolean) => boolean): void => { legs.push({ len: 99, build: b, low: true }); };
  row(segsOf(medical));
  row(segsOf(beds));
  // What no branch takes (life support, a rec room): a small branch of its own, never in place of the trauma room.
  row(segsOf(extra));
  // Greenhouses (or ore stores) hung side by side as ribs below room `i` of a module, a rib's pitch apart from `at` along it.
  const ribs = (m: Module, west: boolean, groups: RoomSpec[][], at = 4): boolean => {
    const first = m.spans[0] as [number, number], last = m.spans[m.spans.length - 1] as [number, number];
    const lo = Math.min(first[0], last[0]), hi = Math.max(first[1], last[1]), dir = west ? -1 : 1;
    let x = (west ? hi - 1 : lo) + dir * at - dir * RIB;
    for (const gr of groups) {
      x += dir * RIB;
      // Not on a partition between two rooms.
      while (x >= lo && x < hi && !m.spans.some(([s0, s1]) => x >= s0 && x < s1)) x += dir;
      if (x < lo || x >= hi || !below(m, x, segsOf(gr))) return false;
    }
    return true;
  };
  // A greenhouse: long and narrow, whatever the programme's floor says.
  const house = (f: RoomSpec[]): Seg[] => f.map((r) => ({ spec: r, len: HOUSE }));
  if (plan === 'farmRows') {
    wing((y, west) => {
      // The workshop, then a hall as long as its ribs need; the greenhouses hang off it.
      const n = Math.max(1, farms.length), segs: Seg[] = [...segsOf(shop), { hall: g.hall('hall', 'commons'), len: n * RIB - 3 }];
      const m = side(hubOf(), y, west, segs);
      if (!m) return false;
      const hall = m.spans[segs.length - 1] as [number, number];
      for (const [j, f] of farms.entries()) if (!below(m, (west ? hall[1] - 1 - 4 : hall[0] + 4) + (west ? -1 : 1) * RIB * j, house([f]))) return false;
      return true;
    });
  } else if (plan === 'farmCluster') row(segsOf(shop));
  else if (plan === 'mineWing') {
    wing((y, west) => {
      // Workshop, refinery, the pod bay and its suit room, a lobby and an airlock out of its end; the ore stores hang below.
      const need = 4 + RIB * (oreRooms.length - 1) + 7, segs = [...padded([...segsOf(shop), ...segsOf(refineries).map((x) => ({ ...x, len: Math.max(x.len, HUB) })), ...segsOf(pods)], 6, need), lobby()];
      const m = side(hubOf(), y, west, segs);
      if (!m) return false;
      lock(m, !west);
      return ribs(m, west, oreRooms.map((r) => [r]));
    });
  } else if (plan === 'minePit') {
    wing((y, west) => {
      // A short tube to the refinery hub (nine tiles across, so it clears the command line above it; thirteen along, for two machines on its back wall). Off it, dead ends: an ore
      // store below, and a row off its far side (the workshop, the pod bay, the suit room, a lobby and an airlock out of its end)
      // with the other ore store hung below it. No ore store is a way through.
      const [first, ...more] = segsOf(refineries), hm = side(hubOf(), y, west, first ? [{ ...first, len: HUB }] : [], LONG, 9);
      if (!hm) return false;
      const rowSegs = [...padded([...segsOf(shop), ...more, ...segsOf(pods)], 6), lobby()], rm = side(hm, y, west, rowSegs);
      if (!rm) return false;
      lock(rm, !west);
      return !!oreRooms[0] && !!below(hm, hm.box[0] + 1 + (HUB >> 1), segsOf([oreRooms[0]])) && ribs(rm, west, oreRooms.slice(1).map((r) => [r]));
    });
  }
  if (trade) row(segsOf(works));
  if (secure.length > 0 || commandRoom.mods.length > 0) legs.push({ len: 0, command: true });

  const n = legs.length, sizes = [Math.ceil(n / 2), Math.floor(n / 2)], k = Math.max(1, sizes[0] as number);
  const shuffle = <T,>(a: readonly T[]): T[] => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = c.rng.int(0, i); [b[i], b[j]] = [b[j] as T, b[i] as T]; } return b; };
  const firstWest = c.rng.int(0, 1) === 0;
  const slots = shuffle([true, false].flatMap((west) => {
    const size = sizes[west === firstWest ? 0 : 1] as number;
    return Array.from({ length: size }, (_, r): Slot => ({ west, row: r, size, up: size >= 2 && r === 0, low: r === size - 1 }));
  }));
  const slotOf = new Map<Leg, Slot>();
  const take = (leg: Leg, ok: (s: Slot) => boolean): void => { const i = Math.max(0, slots.findIndex(ok)); slotOf.set(leg, slots.splice(i, 1)[0] as Slot); };
  for (const leg of legs.filter((l) => l.low)) take(leg, (s) => s.low);
  for (const leg of legs.filter((l) => l.command)) take(leg, (s) => s.up || s.low);
  // The rest: the longer in the lower slots, the shorter above.
  slots.sort((a, b) => Number(a.low) - Number(b.low));
  for (const leg of legs.filter((l) => !slotOf.has(l)).sort((a, b) => a.len - b.len)) slotOf.set(leg, slots.shift() as Slot);

  // The market hall down from customs, the warehouse off one side (not the side the command block's pod hangs on above it).
  const [mw, ml] = trade ? MARKET : TRADE_HALL;
  const tradeRoom: RoomSpec = { role: 'plaza', dept: 'market', mods: TRADE, w: mw, h: ml };
  const market = module(mc - 1 - (mw >> 1), bar.box[3] + TUBE, 'v', [{ spec: tradeRoom, len: ml }], { wide: mw });
  if (!market) return { why: 'no ground for the market' };
  tube(mc, bar.box[3] - 1, 0, 1);
  const cmdSlot = slotOf.get(legs.find((l) => l.command) as Leg);
  const storeWest = cmdSlot?.up ? !cmdSlot.west : c.rng.int(0, 1) === 0;
  if (warehouse.length > 0 && !side(market, market.box[1] + 1 + (ml >> 1), storeWest, warehouse)) return { why: 'no ground for the warehouse' };
  // The mess as long as its slots need, the pantry built onto its far end.
  const L = k * PITCH - TUBE;
  const messRoom: RoomSpec | undefined = mess ? { ...mess } : undefined;
  if (messRoom) delete messRoom.annex;
  const hubY = market.box[3] + TUBE;
  const hub = module(mc - 1 - (MESS_WIDE >> 1), hubY, 'v', [messRoom ? { spec: messRoom, len: L } : { hall: g.hall('plaza', 'commons'), len: L }], { wide: MESS_WIDE, ...(mess?.annex ? { square: hubY + L + 1 } : {}) });
  if (!hub) return { why: 'no ground for the mess' };
  mess_ = hub;
  tube(mc, market.box[3] - 1, 0, 1);
  let pantry: Module | null = null;
  if (mess?.annex) {
    const rowY = hub.box[3] - 1, len = Math.max(3, Math.ceil(area(mess.annex) / MESS_WIDE));
    pantry = module(hub.box[0], rowY, 'v', [{ spec: { ...mess.annex }, len, access: [hub.ids[0] as number] }], { wide: MESS_WIDE, host: { m: hub, row: rowY } });
    if (!pantry) return { why: 'no ground for the pantry' };
    g.gate(mc, rowY);
  }
  /**
   * The command block at row y: the command room on its tube from the mess, a hub: the core and the shields in one
   * split pod (core | shields, walked through within the department) down a tube off its outer side (up, in an upper slot),
   * the reactors in one room off its far end on a tube of their own.
   */
  const command = (y: number, west: boolean, up: boolean): boolean => {
    const top = y - (OUT >> 1), out = west ? -1 : 1;
    const cmd = module(west ? hub.box[0] - TUBE - CMD - 2 : hub.box[2] + TUBE, top, 'h', [{ spec: commandRoom, len: CMD }]);
    if (!cmd) return false;
    tube(west ? hub.box[0] : hub.box[2] - 1, y, out, 0);
    const pod = wings.flatMap((r) => segsOf([r])), cx = cmd.box[0] + 1 + (CMD >> 1);
    if (pod.length > 0) {
      if (up) {
        if (!module(cx - (OUT >> 1), cmd.box[1] - TUBE - run(pod) - 2, 'v', pod, { rev: true })) return false;
        tube(cx, cmd.box[1], 0, -1);
      } else {
        if (!module(cx - (OUT >> 1), cmd.box[3] + TUBE, 'v', pod)) return false;
        tube(cx, cmd.box[3] - 1, 0, 1);
      }
    }
    if (plant.length > 0) {
      const segs = segsOf(plant);
      if (!module(west ? cmd.box[0] - TUBE - run(segs) - 2 : cmd.box[2] + TUBE, top, 'h', segs, { rev: west })) return false;
      tube(west ? cmd.box[0] : cmd.box[2] - 1, y, out, 0);
    }
    return true;
  };
  // Tidy turns: none, or a lower branch turned down off its tube (where it fits; else straight). Not where a cluster hangs below.
  const turn = plan === 'farmCluster' ? 'none' : c.rng.pick(['none', 'lower'] as const);
  for (const leg of legs) {
    const s = slotOf.get(leg) as Slot, west = s.west;
    const y = hub.box[1] + 1 + (k - s.size) * (PITCH >> 1) + s.row * PITCH + (OUT >> 1);
    if (leg.command) { if (!command(y, west, s.up)) return { why: 'no ground for command' }; continue; }
    if (leg.build) { if (!leg.build(y, west)) return { why: `no ground for the ${plan} works` }; continue; }
    const segs = leg.segs as Seg[];
    if (s.low && s.size === k && k > 1 && turn === 'lower') {
      // Down off its tube: the front room square on the tube, the rest running south.
      const down = [{ ...(segs[0] as Seg), len: Math.max((segs[0] as Seg).len, PREFAB_WIDE) }, ...segs.slice(1)];
      if (module(west ? hub.box[0] - TUBE - OUT : hub.box[2] + TUBE, y - (OUT >> 1), 'v', down)) { tube(west ? hub.box[0] : hub.box[2] - 1, y, west ? -1 : 1, 0); continue; }
    }
    if (!side(hub, y, west, segs)) return { why: 'no ground for a branch' };
  }
  // The greenhouse cluster: one long tube from the pantry across the ground to a farm hub, greenhouses off its three free sides.
  if (plan === 'farmCluster') {
    const from = pantry ?? hub, groups: RoomSpec[][] = [], sides = Math.min(3, Math.max(1, farms.length));
    for (let i = 0; i < sides; i++) groups.push([]);
    for (const [i, f] of farms.entries()) (groups[i % sides] as RoomSpec[]).push(f);
    const fh = module(mc - 5, from.box[3] + CLUSTER, 'v', [{ hall: g.hall('hall', 'commons'), len: 9 }], { wide: 9 });
    if (!fh) return { why: 'no ground for the farm hub' };
    tube(mc, from.box[3] - 1, 0, 1, CLUSTER);
    const yc = fh.box[1] + 1 + 4;
    // One greenhouse below; two, west and east; three, west, east and below (the two sides swapped by the seed).
    const order: Array<'s' | 'w' | 'e'> = sides === 1 ? ['s'] : sides === 2 ? ['w', 'e'] : ['w', 'e', 's'];
    for (const [i, o] of (c.rng.int(0, 1) === 0 ? order : [...order].reverse()).entries()) {
      const segs = house(groups[i] as RoomSpec[]);
      if (o === 's' ? !below(fh, mc, segs) : !side(fh, yc, o === 'w', segs)) return { why: 'no ground for a greenhouse' };
    }
  }
  return { why: '', pads };
}
