import type { ModuleDef } from '../../registry';
import type { Rng } from '../../rng';
import { shuffle } from '../civilKit';
import { cargoSpec, dockSpec, pickWeighted, weaponSpec, type RoomSpec } from '../plan';
import { stationCrew } from '../stationPlan';
import type { StationDef, StationSize } from '../stationTypes';
import { barracksOf, cabinOf } from './quarters';

/**
 * A station's rooms as the assembly takes them: the kind's doctrine (`StationDef`) at a size tier, as a list of rooms.
 * This is the assembly's own station plan. The station grammars keep theirs (`planStation`), which goes when they do.
 */

/**
 * A room grown past its planned size, which stays its floor (some rooms should be small): most gain one to three
 * tiles along their long side and up to two across, scaled by the station's spaciousness `s`; a quarter (more on a
 * tight station, fewer on a roomy one) keep the planned size.
 */
function grown(rng: Rng, r: RoomSpec, s: number): RoomSpec {
  if (rng.chance(Math.min(0.9, 0.25 / s))) return r;
  const along = Math.round(rng.int(1, 3) * s), across = Math.round(rng.int(0, 2) * s);
  return r.w >= r.h ? { ...r, w: r.w + along, h: r.h + across } : { ...r, w: r.w + across, h: r.h + along };
}

/** Reactor tiers, Mk I to Mk III (50, 100 and 180 power; 2x2, 2x3 and 2x4). */
const REACTOR_TIERS = ['module.reactor', 'module.reactor.mk2', 'module.reactor.mk3'];

/** The planned rooms: command, guns, shields, the core, quarters, messes, the kind's rooms, docks, holds, bays, reactors. */
function planned(rng: Rng, def: StationDef, size: StationSize, defs: Record<string, ModuleDef>): { command: RoomSpec; rest: RoomSpec[] } {
  const t = def.tiers[size];
  const space = def.space ? def.space[0] + rng.next() * (def.space[1] - def.space[0]) : 1;
  const fp = (id: string | undefined): readonly [number, number] => defs[id ?? '']?.footprint ?? [2, 2];
  const big = (id: string): boolean => fp(id)[0] > 2;
  const guns: string[] = [];
  for (let i = 0; i < Math.max(1, t.guns); i++) {
    const heavy = def.weapons.heavy.length > 0 && rng.int(0, 99) < t.heavyPct;
    guns.push(pickWeighted(rng, heavy ? def.weapons.heavy : def.weapons.light));
  }
  // Light guns in pairs (one bay, two mounts), heavy ones alone; gun bays keep the plain mount size.
  const weapons: RoomSpec[] = guns.filter(big).map((g) => weaponSpec(defs, [g]));
  const light = guns.filter((g) => !big(g));
  for (let i = 0; i < light.length; i += 2) weapons.push(weaponSpec(defs, light.slice(i, i + 2)));
  // A station that is not tight gives its shield rooms and its core floor round the machine: a generator with four
  // tiles beside it and three before it, a core vault with two either end and a row to walk.
  const roomy = space >= 0.95;
  const shields: RoomSpec[] = Array.from({ length: t.shields }, (): RoomSpec => {
    const g = pickWeighted(rng, def.shields);
    // 4x4 at least whatever the tier: room for a Mk III generator (3x3) and the walkway to it.
    return { role: 'shields', mods: [g], w: roomy ? Math.max(3, fp(g)[0]) + 4 : 4, h: roomy ? Math.max(3, fp(g)[1]) + 3 : 4 };
  });
  const consoles = ['module.helm', 'module.weaponsConsole', ...(shields.length > 0 ? ['module.shieldConsole'] : [])];
  const command: RoomSpec = { role: 'bridge', mods: consoles, w: size === 'hub' ? 9 : 7, h: size === 'outpost' ? 4 : 5 };
  const core: RoomSpec = { role: 'core', mods: ['module.aiCore', ...Array<string>(t.pointDefense).fill('module.pointDefense')], w: 3 + 3 * t.pointDefense, h: 3 };
  if (roomy) { core.w = core.mods.reduce((n, m) => n + fp(m)[0] + 1, 0) - 1 + 4; core.h = 5; }
  // Long point-defence rows split into separate rooms.
  if (core.w > 12) {
    core.mods = ['module.aiCore', ...Array<string>(3).fill('module.pointDefense')];
    core.w = 12;
  }
  const pdRooms: RoomSpec[] = [];
  for (let k = t.pointDefense - 3; core.w === 12 && k > 0; k -= 2) {
    pdRooms.push({ role: 'weapons', mods: Array<string>(Math.min(2, k)).fill('module.pointDefense'), w: 3 * Math.min(2, k) + 1, h: 3 });
  }
  const crew = stationCrew(rng, def, size);
  const quarters: RoomSpec[] = [];
  if (def.barracks) {
    // Barracks, and a few cabins for those who rate one. Life support as before: one for every four of the crew.
    const like: RoomSpec = { role: 'quarters', mods: [], w: 3, h: 5 }, cabins = Math.min(crew.length, def.barracks.cabins ?? 0);
    const made = barracksOf(rng, like, crew.length - cabins, def.barracks.beds);
    for (let i = 0; i < cabins; i++) made.push(cabinOf(like));
    for (let i = 0; i < Math.ceil(crew.length / 4) && made.length > 0; i++) { const r = made[i % made.length] as RoomSpec; made[i % made.length] = { ...r, mods: [...r.mods, 'module.lifeSupport'] }; }
    quarters.push(...made);
  } else for (let i = 0; i < crew.length; i += 4) {
    const beds = Math.min(4, crew.length - i);
    // A block of one-bed cabins: two wide each and a dividing wall between, three deep behind a wall, and a hallway.
    const cabins = beds > 1;
    quarters.push(grown(rng, { role: 'quarters', mods: [...Array<string>(beds).fill('module.bed'), 'module.lifeSupport'], w: cabins ? 3 * beds - 1 : 6, h: cabins ? 5 : 3, ...(cabins ? { cabins: true } : {}) }, space));
  }
  const support: RoomSpec[] = [];
  // Common rooms: about one for every 12 crew.
  for (let i = 0; i < Math.max(1, Math.round(crew.length / 12)); i++) {
    support.push(grown(rng, { role: 'support', mods: ['module.lifeSupport', ...(i === 0 ? ['module.fabricator'] : [])], w: 5, h: 3 }, space));
  }
  for (const r of def.assemblyRooms ?? def.rooms) {
    for (let i = 0; i < r.count[size]; i++) {
      support.push(grown(rng, { role: r.role, mods: [...r.mods], w: r.w, h: r.h, ...(r.role === 'armoury' || r.items ? { stock: true } : {}), ...(r.items ? { items: r.items } : {}) }, space));
    }
  }
  const docks = Array.from({ length: Math.max(2, t.docks) }, dockSpec);
  const cargo: RoomSpec[] = [];
  for (let left = t.crates; left > 0; left -= 6) cargo.push(grown(rng, cargoSpec(Math.min(6, left)), space));
  const hangars: RoomSpec[] = Array.from({ length: t.bays ?? 0 }, (): RoomSpec => ({ role: 'hangar', mods: ['module.vehicle_bay'], w: 5, h: 7, vehicle: true }));
  // The pod deck: mining pod bays in a row (two rows past four), each with the tile beside it crew unload at, and an aisle.
  const pods = t.pods ?? 0, podRows = pods > 4 ? 2 : 1, perRow = Math.ceil(pods / podRows);
  if (pods > 0) hangars.push({ role: 'hangar', mods: Array<string>(pods).fill('module.pod_bay'), w: 4 * perRow + 1, h: podRows === 1 ? 5 : 8 });
  // The ore store beside it: two ore bins a pod, in a row along each long wall with an aisle between. It is the works'.
  if (pods > 0) support.push({ role: 'cargo', dept: 'works', mods: Array<string>(2 * pods).fill('module.storage_ore'), w: Math.max(5, 2 * pods + 1), h: 6 });
  const rest = [...weapons, ...pdRooms, ...shields, core, ...quarters, ...cargo, ...hangars, ...support];
  // Power: every room's draw, a lamp a room, and a margin for the fittings a fit-out adds; then the smallest reactor
  // tier the size allows that powers the station from one room of two, else the largest.
  const drawing = [command, ...rest, ...docks.slice(2)];
  let demand = 2 + drawing.length;
  for (const r of drawing) for (const m of r.mods) demand += Math.max(0, -(defs[m]?.power ?? 0));
  if (def.atrium) demand *= 1.15;
  if (def.atrium?.role === 'garden') demand += 30;
  const tiers = REACTOR_TIERS.slice(0, size === 'hub' ? 3 : size === 'station' ? 2 : 1).filter((id) => defs[id]);
  const out = (id: string): number => defs[id]?.power ?? 50;
  const id = tiers.find((x) => Math.ceil(demand / out(x)) <= 2) ?? tiers[tiers.length - 1] ?? 'module.reactor';
  // Reactor rooms of two at most, with floor round the reactors: a plant room, not a walkway (more on roomy stations).
  const margin = Math.max(2, Math.round(3 * space));
  const reactors: RoomSpec[] = [];
  for (let k = Math.max(1, Math.ceil(demand / out(id))); k > 0; k -= 2) {
    const m = Math.min(2, k);
    reactors.push({ role: 'reactor', mods: Array<string>(m).fill(id), w: fp(id)[0] * m + margin, h: fp(id)[1] + margin });
  }
  return { command, rest: [...rest, ...reactors, ...docks] };
}

/** Crates a warehouse holds at most; more make a second one. */
const WAREHOUSE = 24;

/** The plan's cargo rooms merged into warehouses: a few large rectangles for aisles of racks, in place of many small crate rooms. */
export function warehoused(rooms: readonly RoomSpec[]): RoomSpec[] {
  const cargo = rooms.filter((r) => r.role === 'cargo' && !r.dept);
  if (cargo.length < 2) return [...rooms];
  const mods = cargo.flatMap((r) => r.mods), items = cargo.flatMap((r) => r.items ?? []);
  const k = Math.max(1, Math.ceil(mods.length / WAREHOUSE));
  const area = cargo.reduce((t, r) => t + r.w * r.h, 0) / k;
  const out: RoomSpec[] = rooms.filter((r) => !cargo.includes(r));
  for (let i = 0; i < k; i++) {
    const mine = items.filter((_, j) => j % k === i);
    // Wide and shallow (about 8:5), at least five deep for two aisles of racks.
    const h = Math.max(5, Math.round(Math.sqrt(area / 1.6)));
    out.push({ role: 'cargo', mods: mods.filter((_, j) => j % k === i), w: Math.max(h, Math.ceil(area / h)), h, stock: true, warehouse: true, ...(mine.length > 0 ? { items: mine } : {}) });
  }
  return out;
}

/**
 * Medbays: one for every five quarters rooms (at least one), two to four cots each. A large station has a clinic
 * instead: a ward and two treatment rooms.
 */
function medbays(rooms: readonly RoomSpec[]): RoomSpec[] {
  const quarters = rooms.filter((r) => r.role === 'quarters').length;
  if (quarters === 0) return [];
  const room = (cots: number): RoomSpec => ({ role: 'medbay', mods: Array<string>(cots).fill('module.med_bed'), w: 2 * cots + 1, h: 4 });
  if (quarters >= 8) return [room(4), room(1), room(1)];
  const n = Math.max(1, Math.round(quarters / 5));
  return Array.from({ length: n }, () => room(Math.min(4, 1 + Math.ceil(quarters / n / 2))));
}

/** Plant rooms: one for every reactor room, two at least, so the machinery has working rooms round it. */
function plant(rooms: readonly RoomSpec[]): RoomSpec[] {
  const reactors = rooms.filter((r) => r.role === 'reactor').length;
  return reactors === 0 ? [] : Array.from({ length: Math.max(2, reactors) }, (): RoomSpec => ({ role: 'plant', mods: ['module.lifeSupport'], w: 5, h: 4 }));
}

/**
 * The common rooms as a mess and a rec room: the first one (two at hub size) is a mess with a galley and a game
 * table, and from station size up the next is a rec room with arcade cabinets and a game table. They are the commons
 * department. The fabricator the first common room held goes to a plant room, the station's workshop.
 */
export function withCommons(rooms: readonly RoomSpec[], size: StationSize): RoomSpec[] {
  const out = rooms.map((r) => ({ ...r, mods: [...r.mods] }));
  const common = out.filter((r) => r.role === 'support' && !r.dept);
  const messes = size === 'hub' ? 2 : 1, rec = size === 'outpost' ? 0 : 1;
  const bench = out.find((r) => r.role === 'plant');
  for (const [i, r] of common.slice(0, messes + rec).entries()) {
    const mess = i < messes;
    if (bench && r.mods.includes('module.fabricator')) {
      r.mods = r.mods.filter((m) => m !== 'module.fabricator');
      bench.mods.push('module.fabricator');
    }
    r.mods.push(...(mess ? ['module.galley', 'module.gametable'] : ['module.arcade', 'module.arcade', 'module.gametable']));
    r.dept = 'commons';
    // Floor for what it holds: a counter and a table with its stools, or a wall of cabinets and a table.
    const long = Math.max(r.w, r.h, mess ? 6 : 5), short = Math.max(Math.min(r.w, r.h), 4);
    [r.w, r.h] = r.w >= r.h ? [long, short] : [short, long];
  }
  return out;
}

/** Every room of a station of `def`'s kind at a size tier, for `assemble`. `commons` false leaves the common rooms plain. */
export function stationProgram(rng: Rng, def: StationDef, size: StationSize, defs: Record<string, ModuleDef>, o: { commons?: boolean } = {}): RoomSpec[] {
  const { command, rest } = planned(rng, def, size, defs);
  const base = warehoused([command, ...shuffle(rng, rest)]);
  const rooms = [...base, ...medbays(base), ...plant(base)];
  return o.commons === false ? rooms : withCommons(rooms, size);
}
