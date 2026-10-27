import type { Rng } from '../rng';
import type { ModuleDef } from '../registry';
import { allRooms, cargoSpec, dockSpec, pickWeighted, weaponSpec, type RoomSpec, type ShipPlan } from './plan';
import type { StationDef, StationSize } from './stationTypes';
import type { ShipRoleDef } from './types';

/**
 * A station's contents for one size tier: the control room, guns (weapon bays: floor mounts under roof turrets, so
 * they sit anywhere inside), shields, the AI core with point defence, quarters for every crew member, messes, holds,
 * the kind's own rooms (farms, refineries, armouries) and the docks. No engines; reactors cover the demand.
 */

export const SECURITY_ROLE = 'role.security';

/** Crew roles: security share by kind (at least one), the rest from the kind's pool after its required roles. */
export function stationCrew(rng: Rng, def: StationDef, size: StationSize): string[] {
  const n = def.tiers[size].crew;
  const sec = Math.max(1, Math.round(n * def.security));
  const crew = [...def.crew.required].slice(0, Math.max(0, n - sec));
  while (crew.length < n - sec) crew.push(pickWeighted(rng, def.crew.pool));
  for (let i = 0; i < sec; i++) crew.push(SECURITY_ROLE);
  return crew;
}

export function planStation(rng: Rng, def: StationDef, size: StationSize, role: ShipRoleDef, defs: Record<string, ModuleDef>): ShipPlan {
  const t = def.tiers[size];
  const big = (id: string): boolean => (defs[id]?.footprint[0] ?? 2) > 2;
  const guns: string[] = [];
  for (let i = 0; i < Math.max(1, t.guns); i++) {
    const heavy = def.weapons.heavy.length > 0 && rng.int(0, 99) < t.heavyPct;
    guns.push(pickWeighted(rng, heavy ? def.weapons.heavy : def.weapons.light));
  }
  // Light guns in pairs (one bay, two mounts), heavy ones alone.
  const weapons: RoomSpec[] = guns.filter(big).map((g) => weaponSpec(defs, [g]));
  const light = guns.filter((g) => !big(g));
  for (let i = 0; i < light.length; i += 2) weapons.push(weaponSpec(defs, light.slice(i, i + 2)));
  const shields: RoomSpec[] = Array.from({ length: t.shields }, () => {
    const g = pickWeighted(rng, def.shields);
    // 4x4 whatever the tier: room for a Mk III generator (3x3) and the walkway to it, so stations can be upgraded.
    return { role: 'shields' as const, mods: [g], w: 4, h: 4 };
  });
  const consoles = ['module.helm', 'module.weaponsConsole', ...(shields.length > 0 ? ['module.shieldConsole'] : [])];
  const command: RoomSpec = { role: 'bridge', mods: consoles, w: size === 'hub' ? 9 : 7, h: size === 'outpost' ? 4 : 5 };
  const core: RoomSpec = { role: 'core', mods: ['module.aiCore', ...Array<string>(t.pointDefense).fill('module.pointDefense')], w: 3 + 3 * t.pointDefense, h: 3 };
  // Long PD rows split into separate core-side rooms so no room outgrows a ring side.
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
  for (let i = 0; i < crew.length; i += 4) {
    const beds = Math.min(4, crew.length - i);
    quarters.push({ role: 'quarters', mods: [...Array<string>(beds).fill('module.bed'), 'module.lifeSupport'], w: 6, h: 3 });
  }
  const support: RoomSpec[] = [];
  for (let i = 0; i < 1 + Math.floor(crew.length / 10); i++) {
    support.push({ role: 'support', mods: ['module.lifeSupport', ...(i === 0 ? ['module.fabricator'] : [])], w: 5, h: 3 });
  }
  for (const r of def.rooms) {
    for (let i = 0; i < r.count[size]; i++) {
      support.push({ role: r.role, mods: [...r.mods], w: r.w, h: r.h, ...(r.role === 'armoury' || r.items ? { stock: true } : {}), ...(r.items ? { items: r.items } : {}) });
    }
  }
  // Two docks come with every ring and lattice; the rest are planned here.
  for (let i = 2; i < t.docks; i++) support.push(dockSpec());
  const cargo: RoomSpec[] = [];
  for (let left = t.crates; left > 0; left -= 6) cargo.push(cargoSpec(Math.min(6, left)));
  const plan: ShipPlan = {
    role, command, weapons: [...weapons, ...pdRooms], shields, engines: 0, reactors: 1, core, pd: [], quarters, cargo, hangars: [], support, crew,
    size: size === 'hub' ? 3 : size === 'station' ? 2 : 1,
  };
  // Power: enough reactors for every room's draw plus lamps (about 3 a room).
  let demand = 2 + allRooms(plan).length * 3;
  for (const r of allRooms(plan)) for (const m of r.mods) demand += Math.max(0, -(defs[m]?.power ?? 0));
  plan.reactors = Math.max(1, Math.ceil(demand / (defs['module.reactor']?.power ?? 50)));
  return plan;
}
