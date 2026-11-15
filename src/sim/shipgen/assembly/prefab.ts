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
 * The layout (P1): the dock module along the rock face (office | arrivals | armoury, the airlocks in its outer wall
 * over arrivals); a tube to the customs node; a module out from the node on each other side (the market west, the
 * habitat east, command south) and more off their ends (the stores under the market, the rest of the beds under the
 * habitat, the power beside command, a small gun module off each outer end). No hangar: a small airlock module off the
 * dock module's end, and beside it a pad kept clear on the ground for the shuttle (#509).
 * Painted solid first, floor cut out, so every wall is one tile; a cut corner is a stair of wall (the seal rule allows
 * no floor diagonal to space, so the floor's corner tile is wall too).
 */

/** Tiles inside a module, across it. */
export const PREFAB_WIDE = 6;
/** Floor tiles in a tube, wall to wall. */
const TUBE = 3;
/** The shuttle pad's side. */
const PAD = 9;

type Box = [number, number, number, number];
interface Seg { spec?: RoomSpec; hall?: number; len: number; annexed?: boolean }
interface Module { box: Box; dir: 'h' | 'v'; segs: Seg[]; ids: number[] }

const area = (r: RoomSpec): number => r.w * r.h;
/** A room's length along a module: its floor over the module's width, three at least (a gun bay five, for its mounts). */
const lengthOf = (r: RoomSpec): number => Math.max(r.role === 'weapons' ? 5 : 3, Math.ceil(area(r) / PREFAB_WIDE));
const segsOf = (rooms: readonly RoomSpec[]): Seg[] => rooms.flatMap((r) => [{ spec: r, len: lengthOf(r) }, ...(r.annex ? [{ spec: { ...r.annex }, len: lengthOf(r.annex), annexed: true }] : [])]);
const run = (segs: readonly Seg[]): number => segs.reduce((n, s) => n + s.len + 1, -1);

export interface Prefab { why: string; pad?: Box }

export function prefab(c: Ctx, rooms: readonly RoomSpec[], docks: readonly RoomSpec[], cabins: readonly RoomSpec[]): Prefab {
  const g = c.g, taken = new Set<RoomSpec>();
  const pick = (p: (r: RoomSpec) => boolean): RoomSpec[] => { const out = rooms.filter((r) => !taken.has(r) && p(r)); for (const r of out) taken.add(r); return out; };
  const role = (...roles: RoomRole[]) => (r: RoomSpec): boolean => roles.includes(r.role);
  // The departments, module by module.
  const office = pick((r) => r.role === 'bridge' && r.dept === 'harbour'), armoury = pick((r) => r.role === 'armoury');
  const guns = pick(role('weapons'));
  const market = pick((r) => r.dept === 'market');
  const beds = pick((r) => r.role === 'quarters' && r.dept !== 'harbour'), chief = pick((r) => r.role === 'quarters');
  const commons = pick((r) => r.dept === 'commons' || r.dept === 'habitation');
  const power = pick(role('reactor'));
  const command = pick((r) => r.dept === 'secure' || r.role === 'bridge');
  const stores = pick(() => true);
  // A market room among the stalls: the trading floor (not in the programme; it stands for the market itself).
  const floor: RoomSpec = { role: 'plaza', dept: 'market', mods: [], w: PREFAB_WIDE, h: PREFAB_WIDE };
  const stalls = [...market.slice(0, market.length >> 1), floor, ...market.slice(market.length >> 1)];
  // Habitat: a barracks, the mess and the medbay by the node; the other beds and the chief's cabin beyond.
  const habitat1 = [...beds.slice(0, 1), ...commons.filter((r) => r.role !== 'quarters')];
  const habitat2 = [...beds.slice(1), ...chief, ...cabins];

  const placed: Module[] = [];
  const clear = (b: Box): boolean => {
    // Two tiles of ground at least to every other module, and nothing on the pad.
    for (const m of placed) if (b[0] < m.box[2] + 2 && m.box[0] < b[2] + 2 && b[1] < m.box[3] + 2 && m.box[1] < b[3] + 2) return false;
    for (let y = b[1]; y < b[3]; y++) for (let x = b[0]; x < b[2]; x++) if (!c.free(x, y)) return false;
    return true;
  };
  /** A module whose outer box starts at (x, y), running east ('h') or south ('v'); null when the ground is taken. */
  const module = (x: number, y: number, dir: 'h' | 'v', segs: Seg[]): Module | null => {
    const L = run(segs), box: Box = dir === 'h' ? [x, y, x + L + 2, y + PREFAB_WIDE + 2] : [x, y, x + PREFAB_WIDE + 2, y + L + 2];
    if (segs.length === 0 || !clear(box)) return null;
    g.rect(SOLID, ...box);
    const ids: number[] = [];
    let a = 1, before = -1;
    for (const [i, s] of segs.entries()) {
      const id = s.hall ?? g.room(s.spec?.role ?? 'hall', { spec: { ...(s.spec as RoomSpec), w: s.len, h: PREFAB_WIDE }, doors: 0, access: s.annexed && before >= 0 ? [before] : [] });
      const r: Box = dir === 'h' ? [x + a, y + 1, x + a + s.len, y + 1 + PREFAB_WIDE] : [x + 1, y + a, x + 1 + PREFAB_WIDE, y + a + s.len];
      g.rect(id, ...r);
      ids.push(id);
      if (!s.annexed) before = id;
      // A door in the partition after it, at its middle.
      if (i < segs.length - 1) g.gate(...(dir === 'h' ? [x + a + s.len, y + 1 + (PREFAB_WIDE >> 1)] : [x + 1 + (PREFAB_WIDE >> 1), y + a + s.len]) as [number, number]);
      a += s.len + 1;
    }
    // The corners cut: the corner tile open, the floor's corner tile wall.
    for (const [cx, cy, dx, dy] of [[box[0], box[1], 1, 1], [box[2] - 1, box[1], -1, 1], [box[0], box[3] - 1, 1, -1], [box[2] - 1, box[3] - 1, -1, -1]] as const) {
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
  const mid = (m: Module): [number, number] => [(m.box[0] + m.box[2] - 1) >> 1, (m.box[1] + m.box[3] - 1) >> 1];
  /** Where segment `i` of a horizontal module runs, x0 and x1 of its floor; of a vertical one, y0 and y1. */
  const span = (m: Module, i: number): [number, number] => { const a = m.segs.slice(0, i).reduce((n, s) => n + s.len + 1, 1) + (m.dir === 'h' ? m.box[0] : m.box[1]); return [a, a + (m.segs[i] as Seg).len]; };

  // The node: customs, a plaza ten long.
  const customs = g.hall('plaza', 'customs');
  const node = module(0, 0, 'h', [{ hall: customs, len: 10 }]);
  if (!node) return { why: 'no ground for the node' };
  const [ncx] = mid(node), G = TUBE + 1;
  // The dock module above it: office | arrivals | armoury, the arrivals' middle over the node's middle.
  const arrivals = g.hall('hall', 'harbour'), ARR = 3 * docks.length + 2 * (docks.length - 1) + 2;
  const dockSegs: Seg[] = [...segsOf(office), { hall: arrivals, len: Math.max(ARR, 9) }, ...segsOf(armoury)];
  const lead = office.length > 0 ? run(segsOf(office)) + 1 : 0, arrLen = (dockSegs[office.length > 0 ? segsOf(office).length : 0] as Seg).len;
  const dock = module(ncx - 1 - lead - (arrLen >> 1), node.box[1] - G - PREFAB_WIDE - 1, 'h', dockSegs);
  if (!dock) return { why: 'no ground for the dock module' };
  tube(ncx, node.box[1], 0, -1);
  // The airlocks against the outer wall over arrivals, hatches in it, two tiles apart.
  const [a0] = span(dock, office.length > 0 ? segsOf(office).length : 0), y0 = dock.box[1];
  const from = a0 + ((arrLen - (3 * docks.length + 2 * (docks.length - 1))) >> 1);
  for (const [i, d] of docks.entries()) {
    const x = from + i * 5;
    g.rect(g.hall('dock', 'airlock', { ...d, w: 3, h: 3 }), x, y0 + 1, x + 3, y0 + 4);
    g.gate(x + 1, y0);
    for (let yy = y0 - 8; yy < y0; yy++) for (let xx = x - 1; xx < x + 4; xx++) c.reserved.add(key(xx, yy));
  }
  // The market west of the node, the habitat east, command south; tubes from the node's walls, on its middle row.
  const row = node.box[1] + 1 + (PREFAB_WIDE >> 1);
  const westL = run(segsOf(stalls)) + 2;
  const mk = module(node.box[0] - G + 1 - westL, node.box[1], 'h', segsOf(stalls));
  if (!mk) return { why: 'no ground for the market' };
  tube(node.box[0], row, -1, 0);
  const hab = module(node.box[2] + G - 1, node.box[1], 'h', segsOf(habitat1));
  if (!hab) return { why: 'no ground for the habitat' };
  tube(node.box[2] - 1, row, 1, 0);
  const cmd = module(ncx - 1 - (PREFAB_WIDE >> 1), node.box[3] + G - 1, 'v', segsOf(command));
  if (cmd) tube(ncx, node.box[3] - 1, 0, 1);
  else if (command.length > 0) return { why: 'no ground for command' };
  // Off their ends: the stores under the market's far end, the other beds under the habitat's, the power beside command.
  const hang = (m: Module, end: 0 | 1, rooms: readonly RoomSpec[]): Module | null => {
    if (rooms.length === 0) return null;
    const i = end === 0 ? 0 : m.segs.length - 1, [s0, s1] = span(m, i), cx = (s0 + s1 - 1) >> 1;
    const made = module(cx - (PREFAB_WIDE >> 1), m.box[3] + G - 1, 'v', segsOf(rooms));
    if (made) tube(cx, m.box[3] - 1, 0, 1);
    return made;
  };
  if (stores.length > 0 && !hang(mk, 0, stores)) return { why: 'no ground for the stores' };
  if (habitat2.length > 0 && !hang(hab, 1, habitat2)) return { why: 'no ground for the rest of the beds' };
  if (power.length > 0) {
    const host = cmd ?? node, [, s1] = cmd ? span(cmd, 0) : [0, row + 1], y = (cmd ? s1 - 1 : row) - (PREFAB_WIDE >> 1);
    const beside = module(host.box[2] + G - 1, y - 1, 'h', segsOf(power));
    if (beside) tube(host.box[2] - 1, y - 1 + 1 + (PREFAB_WIDE >> 1), 1, 0);
    else if (!cmd || !hang(cmd, 1, power)) return { why: 'no ground for the power' };
  }
  // A small gun module off each outer end: the market's west, the habitat's east, then under the stores and the beds.
  for (const [k, gun] of guns.entries()) {
    const segs = segsOf([gun]), L = run(segs) + 2;
    const made = k === 0 ? module(mk.box[0] - G - L + 1, mk.box[1], 'h', segs) : k === 1 ? module(hab.box[2] + G - 1, hab.box[1], 'h', segs) : null;
    if (!made) return { why: `no ground for gun ${k + 1}` };
    if (k === 0) tube(mk.box[0], row, -1, 0);
    else tube(hab.box[2] - 1, row, 1, 0);
  }
  // The small airlock module off the dock module's west end, and the pad beside it on the ground.
  const ak = docks[0];
  if (ak) {
    const box: Box = [dock.box[0] - G - 6 + 1, dock.box[1], dock.box[0] - G + 1, dock.box[1] + 5];
    if (!clear(box)) return { why: 'no ground for the pad airlock' };
    g.rect(SOLID, ...box);
    const hall = g.hall('hall', 'harbour');
    g.rect(hall, box[2] - 2, box[1] + 1, box[2] - 1, box[3] - 1);
    g.rect(g.hall('dock', 'airlock', { ...ak, w: 3, h: 3 }), box[0] + 1, box[1] + 1, box[0] + 4, box[3] - 1);
    g.gate(box[0], box[1] + 2);
    placed.push({ box, dir: 'h', segs: [], ids: [] });
    tube(dock.box[0], box[1] + 2, -1, 0);
    // (the tube's far door is the small module's east wall)
    const pad: Box = [box[0] - 2 - PAD, dock.box[1], box[0] - 2, dock.box[1] + PAD];
    for (let y = pad[1]; y < pad[3]; y++) for (let x = pad[0]; x < pad[2]; x++) { if (!c.free(x, y)) return { why: 'no ground for the pad' }; c.reserved.add(key(x, y)); }
    return { why: '', pad };
  }
  return { why: '' };
}
