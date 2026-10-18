import { Rng } from '../rng';
import type { ModuleDef, ShipTemplate } from '../registry';
import { roleOfLetter } from './canvas';
import { lightRoom, placeOne } from './fit';
import { Layout, type PlacedModule } from './layout';
import { buildSilhouette, pickWeighted, scaled } from './silhouette';
import { validateTemplate } from './validate';
import type { FactionDef, GenResult, GenRoom, RoomRole } from './types';

/** Attempts before giving up on a seed (each reseeds deterministically). */
export const GEN_ATTEMPTS = 24;
const REACTOR_POWER_DEF = 'module.reactor';

/** Seed for attempt `n` of `seed`. */
const attemptSeed = (seed: number, n: number): number => (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(n, 0xc2b2ae35)) >>> 0;

interface Draft {
  lay: Layout;
  rows: string[];
  crew: string[];
  stock: Map<number, { item: string; count: number }[]>;
  vehicles: Set<number>;
}

/** Assign a role to every room label: fixed letters keep theirs, digit slots draw from required roles then the pool. */
function assignRoles(
  rng: Rng, f: FactionDef, labels: { chunk: string; letter: string }[], area: number[], weaponRooms: number,
): RoomRole[] {
  const roles: RoomRole[] = labels.map((l) => roleOfLetter(l.letter) ?? 'cargo');
  // Group mirrored slots ('pod.3.n' and 'pod.3.s' with the same digit) so symmetric motifs get symmetric rooms.
  const groups = new Map<string, number[]>();
  labels.forEach((l, i) => {
    if (roleOfLetter(l.letter)) return;
    const split = f.hull.symmetry === 'loose' && rng.chance(0.25);
    const key = f.hull.symmetry !== 'none' && !split ? `${l.chunk.replace(/\.[ns]$/, '')}:${l.letter}` : `${l.chunk}:${l.letter}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  const open = [...groups.values()];
  for (let i = open.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [open[i], open[j]] = [open[j] as number[], open[i] as number[]];
  }
  const groupArea = (g: number[]): number => Math.min(...g.map((i) => area[i] ?? 0));
  for (const role of f.requiredRooms) {
    if (roles.includes(role) || open.length === 0) continue;
    let at = 0;
    if (role === 'hangar') open.forEach((g, k) => { if (groupArea(g) > groupArea(open[at] as number[])) at = k; });
    for (const i of open.splice(at, 1)[0] as number[]) roles[i] = role;
  }
  // Enough gun rooms for the weapon budget (two light weapons per room).
  while (open.length > 0 && roles.filter((r) => r === 'weapons').length < weaponRooms) {
    for (const i of open.shift() as number[]) roles[i] = 'weapons';
  }
  for (const g of open) {
    const role = pickWeighted(rng, f.rooms);
    for (const i of g) roles[i] = role;
  }
  return roles;
}

const roomsWith = (lay: Layout, ...want: RoomRole[]): number[] =>
  want.flatMap((r) => lay.roles.map((role, i) => (role === r ? i : -1)).filter((i) => i >= 0));

/** Rooms ordered by free floor (most first). */
function byFree(lay: Layout, rooms: number[]): number[] {
  const free = (r: number): number => lay.roomTiles(r).filter((i) => lay.occ[i] === -1).length;
  return [...rooms].sort((a, b) => free(b) - free(a));
}

function powerOf(lay: Layout): { supply: number; demand: number } {
  let supply = 0;
  let demand = 0;
  for (const m of lay.modules) {
    const p = (lay.defs[m.def] as ModuleDef).power;
    if (p > 0) supply += p; else demand -= p;
  }
  return { supply, demand };
}

/** Place a room's fill modules (crates with stock, fabricators). */
function fillRoom(rng: Rng, f: FactionDef, d: Draft, room: number): void {
  for (const rule of f.fill[d.lay.roles[room] as RoomRole] ?? []) {
    const n = rng.int(rule.min, rule.max);
    for (let k = 0; k < n; k++) {
      if (!placeOne(d.lay, rng, rule.def, [room])) break;
      if (rule.stock) {
        d.stock.set(d.lay.modules.length - 1, rule.stock.map((s) => ({ item: s.item, count: rng.int(s.min, s.max) })).filter((s) => s.count > 0));
      }
    }
  }
}

/** Fit out a silhouette. Returns null when a required module does not fit. */
function fitOut(rng: Rng, f: FactionDef, depth: number, rows: string[], roomOf: Int16Array, roles: RoomRole[], defs: Record<string, ModuleDef>): Draft | string {
  const lay = new Layout(rows, roomOf, roles, defs);
  const d: Draft = { lay, rows, crew: [], stock: new Map(), vehicles: new Set() };
  const b = f.budget;
  const all = roles.map((_, i) => i);
  const notIn = (...r: RoomRole[]): number[] => all.filter((i) => !r.includes(lay.roles[i] as RoomRole));
  const engines = Math.max(1, scaled(b.engines, depth));
  let placedEngines = 0;
  for (let i = 0; i < engines; i++) if (placeOne(lay, rng, 'module.engine', roomsWith(lay, 'engine'), { spread: true })) placedEngines++;
  if (placedEngines === 0) return 'no engine fits';
  if (!placeOne(lay, rng, 'module.helm', roomsWith(lay, 'bridge'))) return 'no helm fits';
  const weapons = scaled(b.weapons, depth);
  if (weapons > 0 && !placeOne(lay, rng, 'module.weaponsConsole', roomsWith(lay, 'bridge'))) return 'no weapons console fits';
  const shields = scaled(b.shields, depth);
  if (shields > 0) placeOne(lay, rng, 'module.shieldConsole', roomsWith(lay, 'bridge'));
  if (f.doctrine.boarding) {
    const rooms = [...byFree(lay, roomsWith(lay, 'hangar', 'cargo')), ...byFree(lay, notIn('hangar', 'cargo', 'bridge', 'engine', 'hall'))];
    const bay = placeOne(lay, rng, 'module.vehicle_bay', rooms);
    if (!bay) return 'no shuttle bay fits';
    d.vehicles.add(lay.modules.length - 1);
    lay.roles[lay.roomOf[bay.y * lay.w + bay.x] as number] = 'hangar';
  }
  if (!placeOne(lay, rng, 'module.airlock', byFree(lay, notIn('bridge', 'engine', 'hangar')))) return 'no airlock fits';
  if (f.aiCore) {
    if (!placeOne(lay, rng, 'module.aiCore', roomsWith(lay, 'core', 'bridge'))) return 'no AI core fits';
    const pd = scaled(b.pointDefense, depth);
    for (let i = 0; i < pd; i++) placeOne(lay, rng, 'module.pointDefense', byFree(lay, roomsWith(lay, 'core', 'weapons')), { spread: true });
  }
  let armed = 0;
  for (let i = 0; i < weapons; i++) {
    const heavy = f.weapons.heavy.length > 0 && rng.int(0, 99) < scaled(b.heavyPct, depth);
    const pick = pickWeighted(rng, heavy ? f.weapons.heavy : f.weapons.light);
    const rooms = [...byFree(lay, roomsWith(lay, 'weapons')), ...byFree(lay, roomsWith(lay, 'cargo'))];
    const gun = placeOne(lay, rng, pick, rooms, { spread: true }) ?? placeOne(lay, rng, pickWeighted(rng, f.weapons.light), rooms, { spread: true });
    if (!gun) continue;
    armed++;
    lay.roles[lay.roomOf[gun.y * lay.w + gun.x] as number] = 'weapons';
  }
  if (weapons > 0 && armed === 0) return 'no weapon fits';
  for (let i = 0; i < shields; i++) {
    placeOne(lay, rng, pickWeighted(rng, f.shields), [...byFree(lay, roomsWith(lay, 'shields')), ...byFree(lay, notIn('hall', 'bridge', 'shields'))]);
  }
  // Rooms that ended up empty of their signature module become cargo.
  lay.roles = lay.roles.map((r, i) => {
    const has = (pred: (m: ModuleDef) => boolean): boolean =>
      lay.modules.some((m) => pred(defs[m.def] as ModuleDef) && lay.roomOf[m.y * lay.w + m.x] === i);
    if (r === 'weapons' && !has((m) => !!m.weapon || !!m.pointDefense)) return 'cargo';
    if (r === 'shields' && !has((m) => !!m.shieldGen)) return 'cargo';
    return r;
  });
  const crewCount = Math.max(f.crew.required.length, scaled(b.crew, depth));
  d.crew = [...f.crew.required];
  while (d.crew.length < crewCount) d.crew.push(pickWeighted(rng, f.crew.pool));
  if (f.living) {
    const beds = roomsWith(lay, 'quarters');
    for (let i = 0; i < d.crew.length; i++) placeOne(lay, rng, 'module.bed', [...byFree(lay, beds), ...byFree(lay, roomsWith(lay, 'cargo'))]);
    const floor = lay.cells.filter((c) => c === '_').length;
    const lsRooms = [...byFree(lay, roomsWith(lay, 'quarters', 'core', 'reactor', 'shields', 'cargo')), ...byFree(lay, notIn('hall', 'bridge'))];
    for (let i = 0; i < 1 + Math.floor(floor / 160); i++) placeOne(lay, rng, 'module.lifeSupport', lsRooms, { spread: true });
  }
  // Rooms still empty (an unused reactor slot, say) become cargo holds.
  const used = new Set(lay.modules.map((m) => lay.roomOf[m.y * lay.w + m.x]));
  lay.roles = lay.roles.map((r, i) => (r !== 'hall' && r !== 'engine' && r !== 'reactor' && !used.has(i) ? 'cargo' : r));
  for (let room = 0; room < lay.roles.length; room++) fillRoom(rng, f, d, room);
  const lights = lay.roles.length * 2;
  const maxReactors = Math.max(1, scaled(b.reactors, depth));
  const reactorRooms = [...roomsWith(lay, 'reactor'), ...byFree(lay, roomsWith(lay, 'engine')), ...byFree(lay, notIn('hall', 'bridge', 'reactor', 'engine'))];
  let reactors = 0;
  while (reactors < maxReactors && powerOf(lay).supply < powerOf(lay).demand + lights) {
    if (!placeOne(lay, rng, REACTOR_POWER_DEF, reactorRooms)) break;
    reactors++;
  }
  if (reactors === 0 && !placeOne(lay, rng, REACTOR_POWER_DEF, reactorRooms)) return 'no reactor fits';
  for (let room = 0; room < lay.roles.length; room++) {
    if (lay.roles[room] !== 'reactor' || lay.modules.some((m) => lay.roomOf[m.y * lay.w + m.x] === room)) continue;
    lay.roles[room] = 'cargo';
    fillRoom(rng, f, d, room);
  }
  for (let room = 0; room < lay.roles.length; room++) lightRoom(lay, rng, room);
  if (powerOf(lay).supply < powerOf(lay).demand) return 'not enough power';
  return d;
}

function toTemplate(f: FactionDef, factionId: string, seed: number, d: Draft): ShipTemplate {
  const tag = (seed >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(-4);
  const modules: NonNullable<ShipTemplate['modules']> = d.lay.modules.map((m: PlacedModule, i) => {
    const stock = d.stock.get(i);
    return {
      def: m.def, x: m.x, y: m.y, rot: m.rot,
      ...(stock && stock.length > 0 ? { stock } : {}),
      ...(d.vehicles.has(i) ? { vehicle: 'vehicle.shuttle' } : {}),
    };
  });
  return {
    name: `${f.name} ${factionId.replace(/^faction\./, '').slice(0, 2).toUpperCase()}-${tag}`,
    faction: 'hostile',
    doctrine: f.doctrine.targeting,
    crew: d.crew,
    rows: d.rows,
    modules,
    ...(f.doctrine.boarding ? { boarding: { ...f.doctrine.boarding } } : {}),
  };
}

/**
 * Generate a ship for a faction, deterministically from `seed` and sector `depth`. Bad layouts are rejected and
 * reseeded up to GEN_ATTEMPTS times; the result carries the problems of the last try if none passed.
 */
export function generateShip(
  f: FactionDef, factionId: string, seed: number, depth: number, defs: Record<string, ModuleDef>,
): GenResult {
  let last: GenResult | null = null;
  const failures: string[] = [];
  for (let n = 0; n < GEN_ATTEMPTS; n++) {
    const rng = new Rng(attemptSeed(seed, n));
    const sil = buildSilhouette(rng, f, Math.max(1, scaled(f.budget.pods, depth)));
    if (!sil) { failures.push('chunks clash'); continue; }
    const { rows, labels: roomOf, width, height } = sil.canvas.crop();
    const area = sil.canvas.labels.map((_, i) => roomOf.filter((l) => l === i).length);
    const roles = assignRoles(rng, f, sil.canvas.labels, area, Math.ceil(scaled(f.budget.weapons, depth) / 2));
    const d = fitOut(rng, f, depth, rows, roomOf, roles, defs);
    if (typeof d === 'string') { failures.push(d); continue; }
    const template = toTemplate(f, factionId, seed, d);
    const problems = validateTemplate(template, defs);
    const rooms: GenRoom[] = d.lay.roles.map((role, id) => ({ id, role, tiles: d.lay.roomTiles(id) }));
    last = { template, rooms, roomOf, width, height, attempts: n + 1, problems };
    if (problems.length === 0) return last;
  }
  if (last) return last;
  throw new Error(`generateShip: no layout for ${factionId} seed ${seed} depth ${depth}: ${failures.join(', ')}`);
}
