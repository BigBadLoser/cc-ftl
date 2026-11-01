/**
 * Station bench: ring frontage and circulation analysis of one generated station (docs/STATIONGEN2.md, step 2).
 *   Ring frontage: the share of the ring corridor's walls (outboard and inboard) with a room behind them, against bare
 *     space; walls onto other corridors (spokes) are left out. The ring is the hall room with the largest bounding box.
 *   Circulation, on a graph of rooms joined by doors (any walkable step between two rooms):
 *     public reach    every public destination reached from every airlock through circulation rooms only;
 *     private routes  public destinations still connected to each other once every private room is taken out;
 *     controlled      each controlled department (secure core, gun bays) is entered from circulation by one room; more
 *                     entrances are bypasses. (No service circulation is designated yet, so back doors are not checked.)
 */
import { airlockTiles, type GenResult, type ModuleDef } from '../../src/sim';
import { content } from '../../src/content';

const defs = content.modules as Record<string, ModuleDef>;

const CIRCULATION = new Set(['hall', 'plaza', 'garden', 'drill']);
const PUBLIC = new Set(['shop', 'support', 'medbay', 'bridge', 'dock']);
const PRIVATE = new Set(['quarters', 'plant', 'reactor', 'shields', 'core', 'armoury', 'cargo', 'weapons', 'industry', 'farm', 'hangar']);
/** Controlled departments by role: each should be entered from circulation at one guarded door. */
const CONTROLLED: Record<string, readonly string[]> = { secure: ['reactor', 'shields', 'core'], defence: ['weapons'] };

export interface Flow {
  /** Ring frontage occupancy: [room walls, all counted walls] outboard and inboard (NaN-free: 0/0 means no ring). */
  ringOut: [number, number];
  ringIn: [number, number];
  /** Public rooms some airlock cannot reach through circulation alone. */
  publicUnreached: number;
  /** Public rooms cut off from the others once the private rooms are taken out. */
  privateRoutes: number;
  /** Extra entrances from circulation into controlled departments (sum over departments of entrances - 1). */
  bypasses: number;
  violations: string[];
}

export function flowOf(g: GenResult): Flow {
  const W = g.width, H = g.height;
  const rows = g.template.rows;
  const cell = (x: number, y: number): string => (x < 0 || y < 0 || x >= W || y >= H ? '.' : (rows[y]?.[x] ?? '.'));
  const walk = (x: number, y: number): boolean => { const c = cell(x, y); return c === '_' || c === 'D'; };
  const room = (x: number, y: number): number => (x < 0 || y < 0 || x >= W || y >= H ? -1 : (g.roomOf[y * W + x] ?? -1));
  const role = (r: number): string => g.rooms[r]?.role ?? '?';
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

  // Room graph: rooms joined by any walkable step; a door tile with no room joins the rooms on either side.
  const adj = new Map<number, Set<number>>();
  const link = (a: number, b: number): void => {
    if (a < 0 || b < 0 || a === b) return;
    (adj.get(a) ?? adj.set(a, new Set()).get(a) as Set<number>).add(b);
    (adj.get(b) ?? adj.set(b, new Set()).get(b) as Set<number>).add(a);
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!walk(x, y)) continue;
    const a = room(x, y);
    const around = DIRS.filter(([dx, dy]) => walk(x + dx, y + dy)).map(([dx, dy]) => room(x + dx, y + dy));
    if (a >= 0) for (const b of around) link(a, b);
    else for (const b of around) for (const c of around) link(b, c);
  }
  const nb = (r: number): Set<number> => adj.get(r) ?? new Set();

  // Airlock rooms: where the airlocks' inside tiles stand.
  const starts = new Set<number>();
  for (const m of g.template.modules ?? []) {
    const d = defs[m.def];
    if (!d?.airlock) continue;
    const a = airlockTiles(d, { ...m, rot: m.rot ?? 0 });
    for (const t of [a.inside, a.inner]) { const r = room(t.x, t.y); if (r >= 0) starts.add(r); }
  }
  const rooms = g.rooms.filter((r) => r.tiles.length > 0).map((r) => r.id);
  const pub = rooms.filter((r) => PUBLIC.has(role(r)));
  const violations: string[] = [];

  // Public reach: from each airlock room through circulation; a destination counts when it borders what was reached.
  const unreached = new Set<number>();
  for (const s of starts) {
    const seen = new Set<number>([s]);
    const stack = [s];
    while (stack.length > 0) for (const t of nb(stack.pop() as number)) if (!seen.has(t) && CIRCULATION.has(role(t))) { seen.add(t); stack.push(t); }
    for (const p of pub) if (!seen.has(p) && ![...nb(p)].some((t) => seen.has(t))) unreached.add(p);
  }
  for (const p of unreached) violations.push(`public ${role(p)}#${p} not on circulation`);

  // Private routes: components of the rooms left once the private ones go; public rooms outside the main one are cut off.
  const comp = new Map<number, number>();
  for (const r of rooms) {
    if (PRIVATE.has(role(r)) || comp.has(r)) continue;
    comp.set(r, r);
    const stack = [r];
    while (stack.length > 0) for (const t of nb(stack.pop() as number)) if (!comp.has(t) && !PRIVATE.has(role(t))) { comp.set(t, r); stack.push(t); }
  }
  const counts = new Map<number, number>();
  for (const p of pub) counts.set(comp.get(p) as number, (counts.get(comp.get(p) as number) ?? 0) + 1);
  const main = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const cut = pub.filter((p) => comp.get(p) !== main);
  for (const p of cut) violations.push(`public ${role(p)}#${p} only through private rooms`);

  // Controlled departments: every controlled room bordering circulation is an entrance; a department wants one.
  let bypasses = 0;
  for (const [dept, roles] of Object.entries(CONTROLLED)) {
    const group = rooms.filter((r) => roles.includes(role(r)));
    const doors = group.filter((q) => [...nb(q)].some((t) => CIRCULATION.has(role(t)))).length;
    if (doors > 1) { bypasses += doors - 1; violations.push(`controlled ${dept}: ${doors} entrances from circulation`); }
  }

  // Ring frontage.
  const ringOut: [number, number] = [0, 0], ringIn: [number, number] = [0, 0];
  let ring = -1, span = 0;
  for (const r of g.rooms) {
    if (r.role !== 'hall' || r.tiles.length === 0) continue;
    const xs = r.tiles.map((i) => i % W), ys = r.tiles.map((i) => Math.floor(i / W));
    const s = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    if (s > span) { span = s; ring = r.id; }
  }
  if (ring >= 0) {
    const tiles = g.rooms[ring]?.tiles ?? [];
    const xs = tiles.map((i) => i % W), ys = tiles.map((i) => Math.floor(i / W));
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const seen = new Set<string>();
    for (const i of tiles) {
      const x = i % W, y = Math.floor(i / W);
      for (const [dx, dy] of DIRS) {
        const c = cell(x + dx, y + dy);
        if (c === '_') continue;
        const k = `${x + dx},${y + dy}`;
        if (seen.has(k)) continue;
        seen.add(k);
        // The first cell past the wall (a stair-stepped corner can make it two thick); a partition (wall all the way)
        // is left out.
        let bx = x + 2 * dx, by = y + 2 * dy;
        if (cell(bx, by) === '#') { bx += dx; by += dy; }
        if (cell(bx, by) === '#') continue;
        const r2 = walk(bx, by) ? room(bx, by) : -1;
        if (r2 === ring || (r2 >= 0 && CIRCULATION.has(role(r2)))) continue;
        const out = Math.hypot(bx - cx, by - cy) > Math.hypot(x - cx, y - cy);
        const tally = out ? ringOut : ringIn;
        tally[1]++;
        if (r2 >= 0) tally[0]++;
      }
    }
  }
  return { ringOut, ringIn, publicUnreached: unreached.size, privateRoutes: cut.length, bypasses, violations };
}
