import type { Rng } from '../rng';
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

/** A room the structure must provide: its role, the modules it will hold, and its interior size (tiles). */
export interface RoomSpec {
  role: RoomRole;
  mods: string[];
  w: number;
  h: number;
  /** Crates get starting stock; a vehicle bay gets a shuttle. */
  stock?: boolean;
  vehicle?: boolean;
  /** No door: equipment serviced from outside; its footprint fills the room (no connectivity check). */
  sealed?: boolean;
  /** Storage here starts with these instead of the faction's stock (a station armoury's weapons). */
  items?: readonly { item: string; min: number; max: number }[];
}

/** Everything the ship carries, grouped into rooms. Topologies decide where each room goes. */
export interface ShipPlan {
  role: ShipRoleDef;
  command: RoomSpec;
  weapons: RoomSpec[];
  shields: RoomSpec[];
  engines: number;
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

export const reactorSpec = (k: number): RoomSpec => ({ role: 'reactor', mods: Array<string>(k).fill('module.reactor'), w: 2 * k + 1, h: 3 });

/** Engine room for k engines stacked along the east hull. `door` is the wall crew enter by. */
export const engineSpec = (k: number, door: 'w' | 'ns'): RoomSpec => ({
  role: 'engine', mods: Array<string>(k).fill('module.engine'), w: door === 'w' ? 5 : 4, h: door === 'w' ? 4 * k : 4 * k + 1,
});

export const dockSpec = (): RoomSpec => ({ role: 'dock', mods: ['module.airlock'], w: 3, h: 3 });

export function cargoSpec(n: number): RoomSpec {
  return { role: 'cargo', mods: Array<string>(n).fill('module.storage'), w: Math.max(3, Math.ceil(n / 2) + 1), h: 3, stock: true };
}

/** Budget values for a ship of this role at this depth. */
function budgetOf(f: FactionDef, role: ShipRoleDef, depth: number): Record<keyof ShipBudget, number> {
  const out = {} as Record<keyof ShipBudget, number>;
  for (const k of Object.keys(f.budget) as (keyof ShipBudget)[]) out[k] = Math.max(0, scaled(f.budget[k], depth) + (role.bonus?.[k] ?? 0));
  return out;
}

/** Plan the ship's contents: weapons, defences, engines, power, crew and stores, grouped into rooms. */
export function planShip(rng: Rng, f: FactionDef, role: ShipRoleDef, depth: number, defs: Record<string, ModuleDef>): ShipPlan {
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
    const big = (defs[g]?.footprint[1] ?? 2) > 2;
    shields.push({ role: 'shields', mods: [g], w: big ? 4 : 3, h: big ? 4 : 3 });
  }
  // Crewed ships fly from a helm; AI-run ships have no helm, the AI core is their bridge (one weapons console stays:
  // weapons charge only with a manned console).
  const consoles = f.living ? ['module.helm', 'module.weaponsConsole', ...(shields.length > 0 ? ['module.shieldConsole'] : [])] : ['module.weaponsConsole'];
  if (!f.living && f.aiCore) consoles.push('module.aiCore');
  const command: RoomSpec = { role: f.living ? 'bridge' : 'core', mods: consoles, w: 7, h: f.living ? 4 : 5 };
  const pdCount = f.aiCore ? b.pointDefense : 0;
  const core = f.aiCore && f.living ? { role: 'core' as const, mods: ['module.aiCore', ...Array<string>(pdCount).fill('module.pointDefense')], w: 3 + 3 * pdCount, h: 3 } : null;
  const pd = !f.living ? Array.from({ length: pdCount }, () => ({ role: 'weapons' as const, mods: ['module.pointDefense'], w: 3, h: 3 })) : [];
  const crew = [...f.crew.required];
  while (crew.length < Math.max(f.crew.required.length, b.crew)) crew.push(pickWeighted(rng, f.crew.pool));
  const quarters: RoomSpec[] = [];
  const support: RoomSpec[] = [];
  if (f.living) {
    for (let i = 0; i < crew.length; i += 4) {
      const beds = Math.min(4, crew.length - i);
      quarters.push({ role: 'quarters', mods: [...Array<string>(beds).fill('module.bed'), 'module.lifeSupport'], w: 6, h: 3 });
    }
    for (let i = 0; i < 1 + Math.floor(crew.length / 6); i++) {
      support.push({ role: 'support', mods: ['module.lifeSupport', ...(i === 0 && rng.chance(0.5) ? ['module.fabricator'] : [])], w: 4, h: 3 });
    }
  }
  const cargo: RoomSpec[] = [];
  for (let left = b.crates; left > 0; left -= 6) cargo.push(cargoSpec(Math.min(6, left)));
  const hangars: RoomSpec[] = Array.from({ length: role.bays ?? (f.doctrine.boarding ? 1 : 0) }, () => ({
    role: 'hangar' as const, mods: ['module.vehicle_bay'], w: 5, h: 7, vehicle: true,
  }));
  const plan: ShipPlan = {
    role, command, weapons, shields, engines: Math.max(1, b.engines), reactors: 1, core, pd, quarters, cargo, hangars, support, crew,
    size: b.size,
  };
  // Power: enough reactors for the plan, or drop guns until the reactor cap covers it.
  const demandOf = (): number => {
    const rooms = allRooms(plan);
    let d = plan.engines * 6 + 2 + rooms.length * 3;
    for (const r of rooms) for (const m of r.mods) d += Math.max(0, -(defs[m]?.power ?? 0));
    return d;
  };
  const supply = defs['module.reactor']?.power ?? 50;
  while (plan.weapons.length > 1 && Math.ceil(demandOf() / supply) > Math.max(1, b.reactors)) plan.weapons.pop();
  plan.reactors = Math.max(1, Math.ceil(demandOf() / supply));
  return plan;
}

/** Every room spec of a plan (except engines and reactors, which topologies size themselves). */
export function allRooms(p: ShipPlan): RoomSpec[] {
  return [p.command, ...p.weapons, ...p.shields, ...(p.core ? [p.core] : []), ...p.pd, ...p.quarters, ...p.cargo, ...p.hangars, ...p.support];
}
