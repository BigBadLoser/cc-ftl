import type { ModuleDef } from '../../registry';
import { Rng } from '../../rng';
import { enginesShort, fitShell, seedOf } from '../generate';
import { dockSpec, engineSpec, planShip, reactorSpec, type RoomSpec, type ShipPlan } from '../plan';
import { pairUp } from '../topoNavy';
import type { FactionDef, GenResult, ShipRoleDef } from '../types';
import { RegionGrid, SOLID, SPACE } from './regions';

/**
 * A navy hull on the region grid (SHIPGEN_V4 step 2, prototype): a straight spine corridor bow to stern, mirrored strips
 * of rooms either side of it, gun rooms standing out of the strips as sponsons, the bridge across the bow with its
 * plating stepped in, a nose gun ahead of it when the guns are odd, and the drive bank across the stern. Each room is
 * drawn as its floor; every tile beside a floor that no floor owns is wall (one tile thick, as rooms stand a wall apart),
 * and doors are the grid's.
 */

/** Floor depth of an ordinary strip room. */
const STRIP = 3;
/** Rows a gun room stands out past its strip. */
const SPONSON = 2;
/** Strip order, bow to stern: guns forward, then defences, command support, crew, stores aft. */
const ZONE = ['weapons', 'shields', 'core', 'dock', 'quarters', 'support', 'plant', 'cargo', 'hangar', 'reactor'];

interface Floor { id: number; tiles: [number, number][] }

/** The axis runs between rows -1 and 0: row y mirrors to -1 - y. */
const mirror = (y: number): number => -1 - y;

export function assembleNavy(f: FactionDef, factionId: string, seed: number, depth: number, defs: Record<string, ModuleDef>, n = 0, extra = 0): GenResult {
  const rng = new Rng(seedOf(seed, n));
  const role = (f.architecture.roles.find((r) => r.id === 'escort') ?? f.architecture.roles[0]) as ShipRoleDef;
  const plan = planShip(rng, f, role, depth, defs, extra);
  const g = new RegionGrid(96);
  const floors: Floor[] = [];
  const room = (spec: RoomSpec, o: { access?: number[]; doors?: number } = {}): number => g.room(spec.role, { spec, ...o });
  const floor = (id: number, tiles: [number, number][]): void => {
    floors.push({ id, tiles });
    for (const [x, y] of tiles) g.set(x, y, id);
  };
  const box = (x0: number, x1: number, y0: number, y1: number, keep: (x: number, y: number) => boolean = () => true): [number, number][] => {
    const out: [number, number][] = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (keep(x, y)) out.push([x, y]);
    return out;
  };
  const both = (tiles: [number, number][]): [number, number][] => tiles.map(([x, y]) => [x, mirror(y)]);

  // The strips: every room but the bridge, paired so the two sides mirror. An odd gun goes to the nose.
  const guns = [...plan.weapons];
  const nose = guns.length % 2 === 1 ? guns.shift() : undefined;
  const body = [...guns, ...plan.shields, ...(plan.core ? [plan.core] : []), ...plan.pd, dockSpec(), dockSpec(), ...plan.quarters, ...plan.support, ...plan.cargo, ...plan.hangars];
  const [north, south] = pairUp([...body].sort((a, b) => ZONE.indexOf(a.role) - ZONE.indexOf(b.role)));
  // A room's floor along the strip and out from the corridor: long side along it.
  const along = (s: RoomSpec): [number, number] => (s.role === 'hangar' ? [s.w, s.h] : [Math.max(s.w, s.h), Math.min(s.w, s.h)]);

  // Bridge: across the bow, the full beam of the strips, its outer rows stepped in (the tapered bow plating).
  const beam = STRIP + 2; // floor rows from the corridor's edge row (-1) out: rows -1 .. -(STRIP + 2)
  const bridgeLen = Math.max(4, Math.ceil((plan.command.w * plan.command.h) / (2 * beam))) + 2;
  const xc = 0; // the corridor's first floor column; the bridge's wall stands at xc - 1
  const bridge = room(plan.command, { doors: 2 });
  const dist = (y: number): number => (y < 0 ? -1 - y : y);
  // A nose gun's rows stay flat across the bridge's bow wall, so the two share one wall and a door.
  const nh = nose ? nose.h + 2 + (nose.h % 2) : 0;
  const flat = Math.max(1, nh / 2);
  const xb = xc - 1 - bridgeLen; // the bridge's bow column on the axis
  floor(bridge, box(xb, xc - 2, -beam, beam - 1, (x, y) => x >= xb + Math.max(0, dist(y) - flat)));
  if (nose) {
    const gun = room(nose, { access: [bridge] });
    const len = nose.w + 1, x1 = xb - 2;
    floor(gun, box(x1 - len + 1, x1, -nh / 2, nh / 2 - 1, (x, y) => x >= x1 - len + 1 + Math.max(0, dist(y) - 1)));
  }

  // Strips, bow to stern: a wall between rooms; gun rooms stand out as sponsons, their outer rows stepped in.
  let x = xc;
  const hallTiles: [number, number][] = [];
  north.forEach((n, i) => {
    const s = south[i] as RoomSpec;
    const [w, d0] = along(n);
    const d = Math.max(STRIP, d0);
    const sponson = n.role === 'weapons' ? SPONSON : 0;
    // Floor rows -3 out to -(2 + d), then the sponson's rows, the outermost with its corners stepped in.
    const outer = -(2 + d + sponson);
    const tiles = box(x, x + w - 1, outer, -3, (tx, ty) => !(sponson > 0 && w >= 4 && ty === outer && (tx === x || tx === x + w - 1)));
    floor(room(n), tiles);
    floor(room({ ...s, w, h: d }), both(tiles));
    x += w + 1;
  });
  const xs = x; // the stern hall's first column (x - 1 is the strips' last wall)

  // Stern: engines and reactors stacked across a transverse hall, mirrored, a centre room on the axis.
  const items: RoomSpec[] = [];
  let eLeft = plan.engines, rLeft = plan.reactors;
  let centre: RoomSpec;
  if (eLeft % 2 === 1) { centre = engineSpec(1, 'w', plan.kit); eLeft--; } else { const k = Math.min(rLeft % 2 === 1 ? 1 : 2, rLeft); centre = reactorSpec(k, plan.kit); rLeft -= k; }
  while (eLeft > 0 || rLeft > 0) {
    if (rLeft > 0) { const k = Math.min(2, Math.ceil(rLeft / 2)); items.push(reactorSpec(k, plan.kit)); rLeft -= Math.min(rLeft, 2 * k); }
    if (eLeft > 0) { items.push(engineSpec(1, 'w', plan.kit)); eLeft -= 2; }
  }
  // Engines outermost on the stern hull, reactors inboard.
  items.sort((p, q) => (p.role === 'engine' ? 1 : 0) - (q.role === 'engine' ? 1 : 0));
  const sternW = Math.max(centre.w, ...items.map((s) => s.w));
  const x0 = xs + 3;
  const ch = Math.max(2, centre.h + (centre.h % 2));
  floor(room(centre), box(x0, x0 + sternW - 1, -ch / 2, ch / 2 - 1));
  let top = -ch / 2 - 1; // the wall row above the last room
  for (const s of items) {
    const tiles = box(x0, x0 + sternW - 1, top - s.h, top - 1);
    floor(room(s), tiles);
    floor(room(s), both(tiles));
    top -= s.h + 1;
  }
  // Halls: the spine bow to stern, and the stern hall across every strip room and stern room.
  const reach = Math.max(-top - 1, 1 + STRIP + 1);
  hallTiles.push(...box(xc, xs - 1, -1, 0), ...box(xs, xs + 1, -reach, reach - 1));
  const hall = g.hall('hall');
  floor(hall, hallTiles);

  // Walls: every open tile beside a floor.
  for (const fl of floors) for (const [fx, fy] of fl.tiles) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g.at(fx + dx, fy + dy) === SPACE) g.set(fx + dx, fy + dy, SOLID);
  }

  const cell = g.compile(), snap = g.snapshot(cell);
  const at = (cx: number, cy: number): string => snap.rows[cy]?.[cx] ?? '.';
  const rows = snap.rows.map((r, y) => [...r].map((c, cx) => (c === 'D' && [at(cx + 1, y), at(cx - 1, y), at(cx, y + 1), at(cx, y - 1)].includes('.') ? '#' : c)).join(''));
  return fitShell(
    rng, f, factionId, seed, role, 'sections', { crew: plan.crew } as Pick<ShipPlan, 'crew'>,
    { rows, roomOf: snap.roomOf, width: snap.width, height: snap.height, roles: g.regions.map((r) => r.role), specs: g.regions.map((r) => r.spec) },
    'navy v4', defs, n,
  );
}

/** Attempts until one passes (as `generateShip`), the last otherwise. */
export function generateNavy(f: FactionDef, factionId: string, seed: number, depth: number, defs: Record<string, ModuleDef>): GenResult {
  const failures: string[] = [];
  let last: GenResult | null = null;
  for (let n = 0; n < 24; n++) {
    // A hull its engines cannot carry is built again with the engines it lacks (as `generateAttempt`).
    let r = assembleNavy(f, factionId, seed, depth, defs, n);
    for (let k = 0, extra = 0; k < 3 && r.problems[0]?.startsWith('engines carry'); k++) {
      extra += Math.max(1, enginesShort(defs, r.template));
      r = assembleNavy(f, factionId, seed, depth, defs, n, extra);
    }
    last = { ...r, failures: [...failures] };
    if (r.problems.length === 0) return last;
    failures.push(r.problems[0] as string);
  }
  return last as GenResult;
}
