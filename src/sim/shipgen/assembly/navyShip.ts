import type { ModuleDef } from '../../registry';
import { Rng } from '../../rng';
import { enginesShort, fitShell, previewHull, seedOf } from '../generate';
import { dockSpec, engineSpec, planShip, reactorSpec, type RoomSpec, type ShipPlan } from '../plan';
import { pairUp } from '../topoNavy';
import type { FactionDef, GenResult, HullFamilyDef, ShipRoleDef } from '../types';
import { RegionGrid, SOLID, SPACE } from './regions';

/**
 * Navy hulls on the region grid (SHIPGEN_V4 step 2, prototype). Every type is mirrored about a long axis and built from
 * the same parts: corridors bow to stern, strips of rooms along them, gun rooms standing out of the strips as sponsons,
 * a bow room across the beam with its plating stepped in, and the drive bank across the stern. The type picks the parts:
 * one spine or two round a centre lane (a citadel, a hangar deck), what stands at the bow (the bridge, or a gun deck
 * with the bridge amidships), and where the guns go (forward, or spread along the hull). Each room is drawn as its
 * floor; every tile beside a floor that no floor owns is wall (one thick, as rooms stand a wall apart); doors are the grid's.
 */

export type NavyType = 'corvette' | 'frigate' | 'destroyer' | 'cruiser' | 'carrier';

interface Shape {
  /** A lane of rooms on the axis between two corridors: the citadel (core and shields) or the hangar deck. */
  centre: 'none' | 'citadel' | 'deck';
  /** The bridge across the bow, or a gun deck there and the bridge amidships, the ops room across from it. */
  bow: 'bridge' | 'battery';
  /** Gun rooms first in the strips, or one between every few rooms down the hull. */
  guns: 'forward' | 'spread';
  /** The family whose budget it plans with (a destroyer is a frigate with more guns and drives, fewer crew). */
  family: string;
  bonus?: Partial<Record<'weapons' | 'engines' | 'crew' | 'crates' | 'shields' | 'pointDefense', number>>;
}

export const NAVY_TYPES: Record<NavyType, Shape> = {
  corvette: { centre: 'none', bow: 'bridge', guns: 'forward', family: 'corvette', bonus: { shields: 1 } },
  frigate: { centre: 'none', bow: 'bridge', guns: 'spread', family: 'frigate' },
  destroyer: { centre: 'none', bow: 'battery', guns: 'forward', family: 'frigate', bonus: { weapons: 4, reactors: 1, engines: 1, crew: -1, crates: -1 } },
  cruiser: { centre: 'citadel', bow: 'bridge', guns: 'spread', family: 'cruiser' },
  carrier: { centre: 'deck', bow: 'bridge', guns: 'spread', family: 'carrier' },
};

/** Floor depth of an ordinary strip room. */
const STRIP = 3;
/** Rows a gun room stands out past its strip. */
const SPONSON = 2;
/** Strip order, bow to stern: guns forward, then defences, command support, crew, stores aft. */
const ZONE = ['weapons', 'bridge', 'shields', 'core', 'dock', 'quarters', 'support', 'plant', 'cargo', 'hangar', 'reactor'];

type Tiles = [number, number][];

/** The axis runs between rows -1 and 0: row y mirrors to -1 - y. */
const mirror = (y: number): number => -1 - y;
const dist = (y: number): number => (y < 0 ? -1 - y : y);
const both = (tiles: Tiles): Tiles => tiles.map(([x, y]) => [x, mirror(y)]);
const box = (x0: number, x1: number, y0: number, y1: number, keep: (x: number, y: number) => boolean = () => true): Tiles => {
  const out: Tiles = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (keep(x, y)) out.push([x, y]);
  return out;
};
/** A room's floor along its lane and across it: long side along, a hangar as planned. */
const along = (s: RoomSpec): [number, number] => (s.role === 'hangar' ? [s.h, s.w] : [Math.max(s.w, s.h), Math.min(s.w, s.h)]);

/** The type a seed builds: its hull family's (`previewHull`), every other frigate a destroyer. */
export function navyTypeOf(f: FactionDef, seed: number, depth: number): NavyType {
  const fam = previewHull(f, seed, depth);
  return fam === 'frigate' && seed % 2 === 0 ? 'destroyer' : ((fam in NAVY_TYPES ? fam : 'frigate') as NavyType);
}

function roleOf(f: FactionDef, type: NavyType, shape: Shape): ShipRoleDef {
  const fam = (f.hullFamilies ?? []).find((h) => h.id === shape.family) as HullFamilyDef;
  const bonus = { ...(fam.bonus ?? {}) } as Record<string, number>;
  for (const [k, v] of Object.entries(shape.bonus ?? {})) bonus[k] = (bonus[k] ?? 0) + v;
  return { id: type, weight: fam.weight, archetypes: [], bonus, ...(fam.bays ? { bays: fam.bays } : {}) };
}

/** The role a navy type plans with: its family's budget and the type's slant. */
export const navyRole = (f: FactionDef, type: NavyType): ShipRoleDef => roleOf(f, type, NAVY_TYPES[type]);

export function assembleNavy(
  f: FactionDef, factionId: string, seed: number, depth: number, defs: Record<string, ModuleDef>, type: NavyType, n = 0, extra = 0,
): GenResult {
  const rng = new Rng(seedOf(seed, n));
  const shape = NAVY_TYPES[type];
  const role = roleOf(f, type, shape);
  const plan = planShip(rng, f, role, depth, defs, extra);
  const g = new RegionGrid(128);
  const floors: Tiles[] = [];
  const room = (spec: RoomSpec, o: { access?: number[]; doors?: number } = {}): number => g.room(spec.role, { spec, ...o });
  const floor = (id: number, tiles: Tiles): void => {
    floors.push(tiles);
    for (const [x, y] of tiles) g.set(x, y, id);
  };

  // What stands where: the centre lane's rooms, the bow's, the pair amidships, and the strips' (paired to mirror).
  const guns = [...plan.weapons];
  const pd = guns.filter((r) => r.mods.every((m) => defs[m]?.pointDefense));
  let main = guns.filter((r) => !pd.includes(r));
  const centre: RoomSpec[] = shape.centre === 'citadel' ? [...(plan.core ? [plan.core] : []), ...plan.shields] : shape.centre === 'deck' ? [...plan.hangars] : [];
  let nose: RoomSpec | undefined;
  let bowRoom: RoomSpec = plan.command;
  const amid: RoomSpec[] = [];
  if (shape.bow === 'battery') {
    // A gun deck across the bow: the biggest gun room, and the next with it when that leaves the rest even.
    const take = main.length % 2 === 1 ? 1 : Math.min(2, main.length);
    const deck = main.slice(0, take);
    main = main.slice(take);
    const mods = deck.flatMap((r) => r.mods);
    bowRoom = { role: 'weapons', mods, w: Math.max(...deck.map((r) => r.w)) + 2, h: deck.reduce((t, r) => t + r.h, 0) + 2 };
    amid.push(plan.command, plan.core ?? { role: 'cargo', mods: [], w: 4, h: 3 });
  } else if (main.length % 2 === 1) nose = main.shift();
  const strip = [
    ...(shape.centre === 'citadel' ? [] : [...plan.shields, ...(plan.core && shape.bow !== 'battery' ? [plan.core] : [])]),
    ...pd, dockSpec(), dockSpec(), ...plan.quarters, ...plan.support, ...plan.cargo, ...(shape.centre === 'deck' ? [] : plan.hangars),
  ].sort((a, b) => ZONE.indexOf(a.role) - ZONE.indexOf(b.role));
  const [gn, gs] = pairUp(main);
  let [north, south] = pairUp(strip);
  if (shape.guns === 'forward') { north = [...gn, ...north]; south = [...gs, ...south]; } else {
    // Spread: a gun pair forward, the rest one every few rooms down the hull.
    const every = Math.max(1, Math.floor(north.length / Math.max(1, gn.length - 1)));
    const weave = (gun: RoomSpec[], rest: RoomSpec[]): RoomSpec[] => {
      const out: RoomSpec[] = [];
      gun.forEach((r, i) => { out.push(r, ...rest.slice(i * every, (i + 1) * every)); });
      return [...out, ...rest.slice(gun.length * every)];
    };
    north = weave(gn, north); south = weave(gs, south);
  }
  if (amid.length === 2) {
    // The bridge and the ops room across from it, a pair of one size, after the guns.
    const [a, b] = amid as [RoomSpec, RoomSpec];
    const w = Math.max(along(a)[0], along(b)[0], 6), h = Math.max(along(a)[1], along(b)[1], 4);
    const k = north.findIndex((r) => r.role !== 'weapons');
    north.splice(k < 0 ? north.length : k, 0, { ...a, w, h });
    south.splice(k < 0 ? south.length : k, 0, { ...b, w, h });
  }

  // A centre lane shorter than the strips takes rooms from them, a pair at a time from aft (stores and crew rooms),
  // while that brings the lanes nearer level: no long empty hold to fill the gap.
  const laneLen = (rooms: RoomSpec[]): number => rooms.reduce((t, r) => t + along(r)[0] + 1, 0);
  for (let i = north.length - 1; centre.length > 0 && i >= 0; i--) {
    const r = north[i] as RoomSpec, step = along(r)[0] + 1;
    if (!['cargo', 'quarters', 'plant', 'support'].includes(r.role)) continue;
    if (laneLen(north) - laneLen(centre) < 1.5 * step) break;
    centre.push(r, south[i] as RoomSpec);
    north.splice(i, 1); south.splice(i, 1);
  }
  // Rows: the centre lane's floor -c .. c - 1, a corridor each side of it (two rows), the strips outside. Without a
  // centre lane, one corridor on the axis (rows -1 and 0).
  const c = centre.length > 0 ? Math.max(...centre.map((r) => along(r)[1])) : 0;
  const ch = c + (c % 2), half = ch / 2;
  const hallN = ch > 0 ? -half - 3 : -1; // the north corridor's outer floor row
  const stripTop = hallN - 2; // the strips' first floor row (north)
  const beamFloor = -(stripTop - STRIP + 1); // floor rows from the axis out to the strips' back walls
  const xc = 0;

  // The bow room: across the full beam, its outer rows stepped in (the tapered bow), flat across a nose gun's rows.
  const doors = ch > 0 ? 4 : 2;
  const nh = nose ? nose.h + 2 + (nose.h % 2) : 0;
  const flat = Math.max(1, nh / 2);
  const bowLen = Math.max(4, Math.ceil((bowRoom.w * bowRoom.h) / (2 * beamFloor))) + flat;
  const xb = xc - 1 - bowLen;
  const bow = room(bowRoom, { doors });
  floor(bow, box(xb, xc - 2, -beamFloor, beamFloor - 1, (x, y) => x >= xb + Math.max(0, dist(y) - flat)));
  if (nose) {
    const gun = room(nose, { access: [bow] });
    const len = nose.w + 1, x1 = xb - 2;
    floor(gun, box(x1 - len + 1, x1, -nh / 2, nh / 2 - 1, (x) => x >= x1 - len + 1));
  }

  // Lanes, bow to stern: a wall between rooms; a lane ends level with the longest (its last room stretched, or a
  // store added). Gun rooms in the strips stand out as sponsons, the outermost row's corners stepped in.
  const len = (rooms: RoomSpec[]): number => rooms.reduce((t, r) => t + along(r)[0] + 1, 0);
  const L = Math.max(len(north), len(centre));
  const evenTo = (rooms: RoomSpec[]): number[] => {
    const ws = rooms.map((r) => along(r)[0]);
    const gap = L - len(rooms);
    if (gap <= 0 || ws.length === 0) return ws;
    const last = ws.length - 1;
    if (gap <= Math.ceil((ws[last] as number) / 2)) ws[last] = (ws[last] as number) + gap;
    else { rooms.push({ role: 'cargo', mods: [], w: gap - 1, h: STRIP }); ws.push(gap - 1); }
    return ws;
  };
  const ws = evenTo(north);
  if (south.length < north.length) south.push(north[north.length - 1] as RoomSpec);
  let x = xc;
  north.forEach((nr, i) => {
    const sr = south[i] as RoomSpec, w = ws[i] as number;
    const d = Math.max(STRIP, along(nr)[1]);
    const sponson = nr.role === 'weapons' ? SPONSON : 0;
    const outer = stripTop - d - sponson + 1;
    const tiles = box(x, x + w - 1, outer, stripTop, (tx, ty) => !(sponson > 0 && w >= 4 && ty === outer && (tx === x || tx === x + w - 1)));
    floor(room({ ...nr, w, h: d }), tiles);
    floor(room({ ...sr, w, h: d }), both(tiles));
    x += w + 1;
  });
  if (ch > 0) {
    const cw = evenTo(centre);
    let cx = xc;
    centre.forEach((r, i) => {
      const w = cw[i] as number;
      floor(room({ ...r, w, h: ch }, { doors: 2 }), box(cx, cx + w - 1, -half, half - 1));
      cx += w + 1;
    });
  }
  const xs = xc + L; // the stern hall's first column

  // Stern: engines and reactors stacked across a transverse hall, mirrored, a centre room on the axis.
  const items: RoomSpec[] = [];
  let eLeft = plan.engines, rLeft = plan.reactors;
  let mid: RoomSpec;
  if (eLeft % 2 === 1) { mid = engineSpec(1, 'w', plan.kit); eLeft--; } else { const k = Math.min(rLeft % 2 === 1 ? 1 : 2, rLeft); mid = reactorSpec(k, plan.kit); rLeft -= k; }
  while (eLeft > 0 || rLeft > 0) {
    if (rLeft > 0) { const k = Math.min(2, Math.ceil(rLeft / 2)); items.push(reactorSpec(k, plan.kit)); rLeft -= Math.min(rLeft, 2 * k); }
    if (eLeft > 0) { items.push(engineSpec(1, 'w', plan.kit)); eLeft -= 2; }
  }
  items.sort((p, q) => (p.role === 'engine' ? 1 : 0) - (q.role === 'engine' ? 1 : 0));
  const sternW = Math.max(mid.w, ...items.map((s) => s.w));
  const x0 = xs + 3;
  const mh = Math.max(2, mid.h + (mid.h % 2));
  floor(room(mid), box(x0, x0 + sternW - 1, -mh / 2, mh / 2 - 1));
  let top = -mh / 2 - 1;
  for (const s of items) {
    const tiles = box(x0, x0 + sternW - 1, top - s.h, top - 1);
    floor(room(s), tiles);
    floor(room(s), both(tiles));
    top -= s.h + 1;
  }
  // Halls: the corridors bow to stern, and the stern hall across every lane and stern room.
  const reach = Math.max(-top - 1, beamFloor);
  const hall = g.hall('hall');
  floor(hall, [...box(xc, xs - 1, hallN, hallN + 1), ...(ch > 0 ? both(box(xc, xs - 1, hallN, hallN + 1)) : []), ...box(xs, xs + 1, -reach, reach - 1)]);

  // Walls: every open tile beside a floor.
  for (const tiles of floors) for (const [fx, fy] of tiles) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g.at(fx + dx, fy + dy) === SPACE) g.set(fx + dx, fy + dy, SOLID);
  }

  const cell = g.compile(), snap = g.snapshot(cell);
  const at = (cx: number, cy: number): string => snap.rows[cy]?.[cx] ?? '.';
  const rows = snap.rows.map((r, y) => [...r].map((ch2, cx) => (ch2 === 'D' && [at(cx + 1, y), at(cx - 1, y), at(cx, y + 1), at(cx, y - 1)].includes('.') ? '#' : ch2)).join(''));
  return fitShell(
    rng, f, factionId, seed, role, 'sections', { crew: plan.crew } as Pick<ShipPlan, 'crew'>,
    { rows, roomOf: snap.roomOf, width: snap.width, height: snap.height, roles: g.regions.map((r) => r.role), specs: g.regions.map((r) => r.spec) },
    `navy ${type}`, defs, n,
  );
}

/** Attempts until one passes (as `generateShip`), the last otherwise. `type` defaults to the seed's (`navyTypeOf`). */
export function generateNavy(f: FactionDef, factionId: string, seed: number, depth: number, defs: Record<string, ModuleDef>, type = navyTypeOf(f, seed, depth)): GenResult {
  const failures: string[] = [];
  let last: GenResult | null = null;
  for (let n = 0; n < 24; n++) {
    // A hull its engines cannot carry is built again with the engines it lacks (as `generateAttempt`).
    let r = assembleNavy(f, factionId, seed, depth, defs, type, n);
    for (let k = 0, extra = 0; k < 3 && r.problems[0]?.startsWith('engines carry'); k++) {
      extra += Math.max(1, enginesShort(defs, r.template));
      r = assembleNavy(f, factionId, seed, depth, defs, type, n, extra);
    }
    last = { ...r, failures: [...failures] };
    if (r.problems.length === 0) return last;
    failures.push(r.problems[0] as string);
  }
  return last as GenResult;
}
