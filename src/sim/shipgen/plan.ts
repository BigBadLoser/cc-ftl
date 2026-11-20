import type { Rng } from '../rng';
import { barracksOf } from './assembly/quarters';
import { ENEMY_DRONES_BASE, ENEMY_DRONE_MIN_DEPTH, ENEMY_DRONE_SECOND_DEPTH } from '../tuning';
import type { ModuleDef } from '../registry';
import type { FactionDef, HullFamilyDef, RoomRole, Scaled, ShipBudget, ShipRoleDef, Weighted } from './types';

/** min(max, floor(base + perDepth * depth)). */
export const scaled = (s: Scaled, depth: number): number => Math.min(s.max, Math.floor(s.base + s.perDepth * depth));

/**
 * What a faction can build at this depth: its hull families (assembly-driven factions) or else its ship roles, weighted by depth. When no
 * weight is positive every entry counts equally. The first draw of a generation attempt picks from this list (`previewHull`).
 */
export function hullChoices(f: FactionDef, depth: number): Weighted<HullFamilyDef | ShipRoleDef>[] {
  const items: readonly (HullFamilyDef | ShipRoleDef)[] = f.hullFamilies && f.hullFamilies.length > 0 ? f.hullFamilies : f.architecture.roles;
  const w = items.map((value) => ({ value, weight: scaled(value.weight, depth) }));
  return w.some((x) => x.weight > 0) ? w : w.map((x) => ({ ...x, weight: 1 }));
}

export function pickWeighted<T>(rng: Rng, items: readonly Weighted<T>[]): T {
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  let r = rng.next() * total;
  for (const i of items) {
    r -= Math.max(0, i.weight);
    if (r < 0) return i.value;
  }
  return (items[items.length - 1] as Weighted<T>).value;
}

/** Shuffle in place with the generator's RNG. */
export function shuffle<T>(rng: Rng, a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/** A station room's department: what the assembly recipes group and place rooms by. */
export type StationDept = 'harbour' | 'habitation' | 'commons' | 'market' | 'freight' | 'secure' | 'defence' | 'works' | 'farm';

/** A room the structure must provide: its role, the modules it will hold, and its interior size (tiles). */
export interface RoomSpec {
  role: RoomRole;
  mods: string[];
  w: number;
  h: number;
  /** Crates get starting stock; a vehicle bay gets a shuttle. */
  stock?: boolean;
  /** A star fort's corner battery (assembly/fort.ts): a pointed room furnished along its diagonal (rooms/rules/bastion.ts). */
  bastion?: true;
  vehicle?: boolean;
  /** A drone bay here is filled with this many drones of this DroneDef id. */
  drones?: { def: string; count: number };
  /** No door: equipment serviced from outside; its footprint fills the room (no connectivity check). */
  sealed?: boolean;
  /** Tiles kept clear between the room's like modules (its engines a gap apart, not stacked wall to wall). */
  gap?: number;
  /** Storage here starts with these instead of the faction's stock (a station armoury's weapons). */
  items?: readonly { item: string; min: number; max: number }[];
  /** Station assembly: the department the room belongs to, when not its role's own (`assembly/dept.ts`). */
  dept?: StationDept;
  /** What a `support` room is for when its modules do not say (a navy ship's filler lounge or gym: assembly/roomSize.ts). */
  use?: 'lounge' | 'gym';
  /** A navy ship's floor opposite a room with no partner its size: cut into filler rooms (assembly/roomSize.ts). */
  fill?: boolean;
  /** A navy ship's cabin block: quarters the layout cuts into cabins, a bed each, off a corridor of their own. */
  block?: boolean;
  /** Station assembly: a one-bed cabin cut from a quarters room. */
  cabin?: boolean;
  /** Station assembly: false keeps a quarters room whole (a barracks); otherwise it may be cut into cabins. */
  cabins?: boolean;
  /** Station assembly: a warehouse (the plan's crate rooms merged), with two doors. */
  warehouse?: boolean;
  /**
   * The station assembly: a small room of its own that stands against this one and opens into it, not onto a hall
   * (a mess's pantry).
   */
  annex?: RoomSpec;
  /** The station assembly: set on an annex as it is laid in a row, right after its room. */
  annexed?: boolean;
}

/** Everything the ship carries, grouped into rooms. Topologies decide where each room goes. */
export interface ShipPlan {
  role: ShipRoleDef;
  command: RoomSpec;
  weapons: RoomSpec[];
  shields: RoomSpec[];
  engines: number;
  /** The engine and reactor modules the plan fits (`coreKit`): Mk I, II or III by depth. */
  kit: CoreKit;
  reactors: number;
  /** Navy-style AI core room (with point defence); drones keep the core in the command room and pods for PD. */
  core: RoomSpec | null;
  pd: RoomSpec[];
  quarters: RoomSpec[];
  cargo: RoomSpec[];
  hangars: RoomSpec[];
  support: RoomSpec[];
  crew: string[];
  /** Structural complexity from the budget. */
  size: number;
}

const sizeOf = (defs: Record<string, ModuleDef>, id: string): number => (defs[id]?.footprint[0] ?? 2);

/** Weapon room for one or two mounts, sized to fit them with a walkway on the inboard side. */
export function weaponSpec(defs: Record<string, ModuleDef>, mods: string[]): RoomSpec {
  if (mods.length === 1) {
    const s = sizeOf(defs, mods[0] as string);
    return { role: 'weapons', mods, w: s + 1, h: s + 1 };
  }
  const s = Math.max(...mods.map((m) => sizeOf(defs, m)));
  return { role: 'weapons', mods, w: s * 2 + 1, h: s + 1 };
}

/**
 * The ship's engine and reactor modules (their tiers): picked once per plan (`coreKit`) and handed to every room builder, so no layout
 * names a tier itself.
 */
export interface CoreKit { engine: string; reactor: string }

/**
 * Reactor room for k reactors laid lengthwise end to end along its back wall (Mk I 2x2, Mk II 2x3, Mk III 2x4, turned),
 * a tile to walk before them: three deep at every tier, so a bigger reactor makes the room longer, not deeper. The width
 * stays odd (a room on a hull's centre line keeps it symmetric).
 */
export const reactorSpec = (k: number, kit: CoreKit): RoomSpec => {
  const len = k * reactorDepth(kit.reactor) + 1;
  return { role: 'reactor', mods: Array<string>(k).fill(kit.reactor), w: len % 2 === 0 ? len + 1 : len, h: 3 };
};

/** Engine room for k engines stacked along the east hull. `door` is the wall crew enter by. */
export const engineSpec = (k: number, door: 'w' | 'ns', kit: CoreKit): RoomSpec => ({
  role: 'engine', mods: Array<string>(k).fill(kit.engine), w: engineDepth(kit.engine) - (door === 'w' ? 0 : 1), h: door === 'w' ? 4 * k : 4 * k + 1,
});

/** Engine module ids, Mk I to Mk III (tiers.ts), and how far each reaches inboard from the hull edge (its long footprint side). */
export const ENGINE_TIERS = ['module.engine', 'module.engine.mk2', 'module.engine.mk3'] as const;
/** Engines in a module count (by def id), any tier. */
export const enginesIn = (m: Record<string, number>): number => ENGINE_TIERS.reduce((t, id) => t + (m[id] ?? 0), 0);
const engineDepth = (engine: string): number => 5 + Math.max(0, ENGINE_TIERS.indexOf(engine as (typeof ENGINE_TIERS)[number]));
/** Reactor module ids, Mk I to Mk III (tiers.ts), and each one's long footprint side. */
export const REACTOR_TIERS = ['module.reactor', 'module.reactor.mk2', 'module.reactor.mk3'] as const;
/** Reactors in a module count (by def id), any tier. */
export const reactorsIn = (m: Record<string, number>): number => REACTOR_TIERS.reduce((t, id) => t + (m[id] ?? 0), 0);
const reactorDepth = (reactor: string): number => 2 + Math.max(0, REACTOR_TIERS.indexOf(reactor as (typeof REACTOR_TIERS)[number]));

/** Tiles of planned room a lamp, halls' share included (measured on generated stations): the fit-out's lamps in a power estimate. */
export const LAMP_AREA = 10;

/** The smallest reactor of `tiers` that covers `demand` with at most two, else the largest (ships and stations). */
export function reactorTier(defs: Record<string, ModuleDef>, demand: number, tiers: readonly string[]): string {
  const have = tiers.filter((id) => defs[id]);
  return have.find((id) => Math.ceil(demand / (defs[id]?.power ?? 50)) <= 2) ?? have[have.length - 1] ?? 'module.reactor';
}

/**
 * The engine and reactor a ship at generation `depth` carries: for each, the highest tier whose blueprint danger tier (`minDanger`) the
 * depth reaches (the generation depth is the node's danger tier), up to the faction's `maxCoreTier`. One owner: plans, rooms, the hull's
 * engine count and the power budget follow it.
 */
export function coreKit(defs: Record<string, ModuleDef>, depth: number, maxTier = 3): CoreKit {
  const top = (tiers: readonly string[]): string => {
    let pick = tiers[0] as string;
    for (const id of tiers.slice(1, maxTier)) if (defs[id] && depth >= (defs[id].blueprint?.minDanger ?? Infinity)) pick = id;
    return pick;
  };
  return { engine: top(ENGINE_TIERS), reactor: top(REACTOR_TIERS) };
}

export const dockSpec = (): RoomSpec => ({ role: 'dock', mods: ['module.airlock'], w: 3, h: 3 });

export function cargoSpec(n: number): RoomSpec {
  return { role: 'cargo', mods: Array<string>(n).fill('module.storage'), w: Math.max(3, Math.ceil(n / 2) + 1), h: 3, stock: true };
}


/**
 * Engines a hull of `perTile` hull tiles per room tile needs to carry the rooms (`specs`) and its own engine rooms (`hullCapacity`); 0
 * with no estimate (`HullFamilyDef.hullPerRoomTile`). Solves `perTile * (rooms + room * engines) <= engines * capacity`.
 */
function hullEngines(defs: Record<string, ModuleDef>, kit: CoreKit, perTile: number, specs: readonly RoomSpec[]): number {
  const cap = defs[kit.engine]?.engine?.hullCapacity ?? 0;
  const room = perTile * engineSpec(1, 'w', kit).w * 4;
  if (perTile <= 0 || cap <= room) return 0;
  return Math.ceil((perTile * specs.reduce((t, r) => t + r.w * r.h, 0)) / (cap - room));
}

/** Budget values for a ship of this role at this depth. */
function budgetOf(f: FactionDef, role: ShipRoleDef, depth: number): Record<keyof ShipBudget, number> {
  const out = {} as Record<keyof ShipBudget, number>;
  for (const k of Object.keys(f.budget) as (keyof ShipBudget)[]) out[k] = Math.max(0, scaled(f.budget[k], depth) + (role.bonus?.[k] ?? 0));
  return out;
}

/**
 * Plan the ship's contents: weapons, defences, engines, power, crew and stores, grouped into rooms. `extraEngines` are engines over the
 * budget, for a hull the budget's engines cannot carry (`generateAttempt`); the reactor cap grows with them, so they cost no guns.
 */
export function planShip(rng: Rng, f: FactionDef, role: ShipRoleDef, depth: number, defs: Record<string, ModuleDef>, extraEngines = 0, hullPerRoomTile = 0): ShipPlan {
  const b = budgetOf(f, role, depth);
  const arch = f.architecture;
  const guns: string[] = [];
  for (let i = 0; i < Math.max(1, b.weapons); i++) {
    const heavy = f.weapons.heavy.length > 0 && rng.int(0, 99) < b.heavyPct;
    guns.push(pickWeighted(rng, heavy ? f.weapons.heavy : f.weapons.light));
  }
  guns.sort((a, c) => sizeOf(defs, c) - sizeOf(defs, a));
  const weapons: RoomSpec[] = [];
  const light = guns.filter((g) => sizeOf(defs, g) <= 2);
  for (const g of guns.filter((x) => sizeOf(defs, x) > 2)) weapons.push(weaponSpec(defs, [g]));
  for (let i = 0; i < light.length; i += arch.battery) weapons.push(weaponSpec(defs, light.slice(i, i + arch.battery)));
  const shields: RoomSpec[] = [];
  for (let i = 0; i < b.shields; i++) {
    const g = pickWeighted(rng, f.shields);
    // Sized from the generator: a tile to walk before it, and on a crewed ship a tile beside it for the door's approach,
    // so the room grows along its strip, not out of it (a section strip is three deep). A sealed pod has no walkway.
    const [gw, gh] = defs[g]?.footprint ?? [2, 2];
    shields.push({ role: 'shields', mods: [g], w: gw + (f.living ? 2 : 1), h: gh + 1 });
  }
  // Crewed ships fly from a helm; AI-run ships have no helm, the AI core is their bridge (one weapons console stays:
  // weapons charge only with a manned console).
  const consoles = f.living ? ['module.helm', 'module.weaponsConsole', ...(shields.length > 0 ? ['module.shieldConsole'] : [])] : ['module.weaponsConsole'];
  if (!f.living && f.aiCore) consoles.push('module.aiCore');
  // Wide enough for the consoles side by side on the back wall (the helm bridge rule), a tile to walk and one spare before them.
  const command: RoomSpec = { role: f.living ? 'bridge' : 'core', mods: consoles, w: Math.max(7, consoles.reduce((n, m) => n + sizeOf(defs, m), 0)), h: f.living ? 4 : 5 };
  const pdCount = f.aiCore ? b.pointDefense : 0;
  // Defence drones (DESIGN.md "Drones"): a bay in the AI room (living crews) or in its own sealed pod (drone ships); it needs the core to run them.
  const dronesOn = !!f.defenceDrones && f.aiCore && depth >= ENEMY_DRONE_MIN_DEPTH;
  const drones = { def: 'drone.defence', count: ENEMY_DRONES_BASE + (depth >= ENEMY_DRONE_SECOND_DEPTH ? 1 : 0) };
  // The core runs the point defence from wherever the mounts stand, so they are hull mounts of their own,
  // not furniture of the core's room: weapon rooms on crewed ships, sealed pods on drone ships.
  const core = f.aiCore && f.living
    ? { role: 'core' as const, mods: ['module.aiCore', ...(dronesOn ? ['module.droneBay'] : [])], w: 4 + (dronesOn ? 3 : 0), h: 3, ...(dronesOn ? { drones } : {}) }
    : null;
  const pdRooms = Array.from({ length: pdCount }, () => ({ role: 'weapons' as const, mods: ['module.pointDefense'], w: 3, h: 3 }));
  if (f.living) weapons.push(...pdRooms);
  const pd: RoomSpec[] = !f.living ? pdRooms : [];
  if (!f.living && dronesOn) pd.push({ role: 'weapons', mods: ['module.droneBay'], w: 3, h: 3, drones });
  const crew = [...f.crew.required];
  while (crew.length < Math.max(f.crew.required.length, b.crew)) crew.push(pickWeighted(rng, f.crew.pool));
  const quarters: RoomSpec[] = [];
  const support: RoomSpec[] = [];
  if (f.living) {
    // The crew sleeps in barracks of bunks along one wall (a ship's rooms are narrow), sized as the rule lays them.
    quarters.push(...barracksOf(rng, { role: 'quarters', mods: [], w: 3, h: 3 }, crew.length, [4, 8], true));
    // Life support stands in plant rooms, not where the crew sleeps (stations do the same): a unit, the fabricator
    // beside the first on half the ships, and a tile to walk in front.
    for (let i = 0; i < 1 + Math.floor(crew.length / 6); i++) {
      const fab = i === 0 && rng.chance(0.5);
      support.push({ role: 'plant', mods: ['module.lifeSupport', ...(fab ? ['module.fabricator'] : [])], w: fab ? 4 : 3, h: 3 });
    }
  }
  const cargo: RoomSpec[] = [];
  for (let left = b.crates; left > 0; left -= 6) cargo.push(cargoSpec(Math.min(6, left)));
  const hangars: RoomSpec[] = Array.from({ length: role.bays ?? (f.doctrine.boarding ? 1 : 0) }, () => ({
    role: 'hangar' as const, mods: ['module.vehicle_bay'], w: 5, h: 7, vehicle: true,
  }));
  const kit = coreKit(defs, depth, f.maxCoreTier);
  const engine = kit.engine;
  // The budget counts Mk I engines: a bigger tier stands in for as many as it out-evades.
  const evade = (id: string): number => (defs[id]?.engine?.evasionPerPower ?? 0) * -(defs[id]?.power ?? 0);
  const budgetEngines = Math.max(1, Math.ceil(b.engines / Math.max(1, evade(engine) / (evade('module.engine') || 1))));
  const booked = Math.max(0, hullEngines(defs, kit, hullPerRoomTile, [command, ...weapons, ...shields, ...(core ? [core] : []), ...pd, ...quarters, ...cargo, ...hangars, ...support]) - budgetEngines);
  const plan: ShipPlan = {
    role, command, weapons, shields, engines: budgetEngines + booked + extraEngines, kit, reactors: 1, core, pd, quarters, cargo, hangars, support, crew,
    size: b.size,
  };
  // Power: enough reactors for the plan, or drop guns until the reactor cap covers it.
  const demandOf = (): number => planDemand(plan, defs);
  // The budget's reactors are Mk I units of power (`mk1`); the ship then fits as few of its own tier as cover the demand.
  const mk1 = defs['module.reactor']?.power ?? 50;
  const cap = Math.max(1, b.reactors) + Math.ceil(((booked + extraEngines) * -(defs[engine]?.power ?? -6)) / mk1);
  // Guns go before point defence when power is short (the last gun first).
  const isPd = (r: RoomSpec): boolean => r.mods.every((m) => !!defs[m]?.pointDefense);
  while (plan.weapons.length > 1 && Math.ceil(demandOf() / mk1) > cap) {
    const gun = plan.weapons.map(isPd).lastIndexOf(false);
    plan.weapons.splice(gun >= 0 ? gun : plan.weapons.length - 1, 1);
  }
  // As on stations (assembly/program.ts): the lamps the fit-out lights count too, and the reactor is the smallest tier the depth allows
  // that powers the ship from at most two, so the fit-out need not squeeze extras in elsewhere.
  const demand = demandOf() + Math.ceil(allRooms(plan).reduce((n, r) => n + r.w * r.h, 0) / LAMP_AREA);
  kit.reactor = reactorTier(defs, demand, REACTOR_TIERS.slice(0, REACTOR_TIERS.indexOf(kit.reactor as (typeof REACTOR_TIERS)[number]) + 1));
  plan.reactors = Math.max(1, Math.ceil(demand / (defs[kit.reactor]?.power ?? mk1)));
  return plan;
}

/** The power a plan's engines and room modules draw, rooms' small loads included; not its lamps (`LAMP_AREA`). */
export function planDemand(plan: ShipPlan, defs: Record<string, ModuleDef>): number {
  const rooms = allRooms(plan);
  let d = plan.engines * -(defs[plan.kit.engine]?.power ?? -6) + 2 + rooms.length * 3;
  for (const r of rooms) for (const m of r.mods) d += Math.max(0, -(defs[m]?.power ?? 0));
  return d;
}

/** Reactors of the plan's tier that power it, its planned rooms' lamps included (`LAMP_AREA`). */
export function reactorsFor(plan: ShipPlan, defs: Record<string, ModuleDef>, hullFloor = 0): number {
  // (Lit floor: the rooms' plan, or the hull's own where it is known and bigger.)
  const floor = Math.max(hullFloor, allRooms(plan).reduce((n, r) => n + r.w * r.h, 0));
  return Math.max(1, Math.ceil((planDemand(plan, defs) + Math.ceil(floor / LAMP_AREA)) / (defs[plan.kit.reactor]?.power ?? 50)));
}

/** Every room spec of a plan (except engines and reactors, which topologies size themselves). */
export function allRooms(p: ShipPlan): RoomSpec[] {
  return [p.command, ...p.weapons, ...p.shields, ...(p.core ? [p.core] : []), ...p.pd, ...p.quarters, ...p.cargo, ...p.hangars, ...p.support];
}
