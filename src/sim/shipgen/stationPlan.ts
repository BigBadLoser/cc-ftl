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

/**
 * A room grown past its planned size, which stays its floor (some rooms should be small): most gain one to three
 * tiles along their long side and up to two across; a quarter keep the planned size.
 */
function grown(rng: Rng, r: RoomSpec): RoomSpec {
  if (rng.chance(0.25)) return r;
  const along = rng.int(1, 3), across = rng.int(0, 2);
  return r.w >= r.h ? { ...r, w: r.w + along, h: r.h + across } : { ...r, w: r.w + across, h: r.h + along };
}

/** Reactor tiers, Mk I to Mk III (50, 100 and 180 power; 2x2, 2x3 and 2x4). */
const REACTOR_TIERS = ['module.reactor', 'module.reactor.mk2', 'module.reactor.mk3'];

/** Crew roles: security share by kind (at least one), the rest from the kind's pool after its required roles. */
export function stationCrew(rng: Rng, def: StationDef, size: StationSize): string[] {
  const n = def.tiers[size].crew;
  const sec = Math.max(1, Math.round(n * def.security));
  const crew = [...def.crew.required].slice(0, Math.max(0, n - sec));
  while (crew.length < n - sec) crew.push(pickWeighted(rng, def.crew.pool));
  for (let i = 0; i < sec; i++) crew.push(SECURITY_ROLE);
  return crew;
}

export function planStation(rng: Rng, def: StationDef, size: StationSize, role: ShipRoleDef, defs: Record<string, ModuleDef>, extraReactors = 0): ShipPlan {
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
    quarters.push(grown(rng, { role: 'quarters', mods: [...Array<string>(beds).fill('module.bed'), 'module.lifeSupport'], w: 6, h: 3 }));
  }
  const support: RoomSpec[] = [];
  for (let i = 0; i < 1 + Math.floor(crew.length / 10); i++) {
    support.push(grown(rng, { role: 'support', mods: ['module.lifeSupport', ...(i === 0 ? ['module.fabricator'] : [])], w: 5, h: 3 }));
  }
  for (const r of def.rooms) {
    for (let i = 0; i < r.count[size]; i++) {
      support.push(grown(rng, { role: r.role, mods: [...r.mods], w: r.w, h: r.h, ...(r.role === 'armoury' || r.items ? { stock: true } : {}), ...(r.items ? { items: r.items } : {}) }));
    }
  }
  // Two docks come with every ring and lattice; the rest are planned here.
  for (let i = 2; i < t.docks; i++) support.push(dockSpec());
  const cargo: RoomSpec[] = [];
  for (let left = t.crates; left > 0; left -= 6) cargo.push(grown(rng, cargoSpec(Math.min(6, left))));
  // Shuttle bays, as on boarding ships (a court may take them over as the hangar deck: stationCourts.ts).
  const hangars: RoomSpec[] = Array.from({ length: t.bays ?? 0 }, () => ({ role: 'hangar', mods: ['module.vehicle_bay'], w: 5, h: 7, vehicle: true }));
  const plan: ShipPlan = {
    role, command, weapons: [...weapons, ...pdRooms], shields, engines: 0, reactors: 1, core, pd: [], quarters, cargo, hangars, support, crew,
    size: size === 'hub' ? 3 : size === 'station' ? 2 : 1,
  };
  // Power: enough reactors for every room's draw plus lamps (about 3 a room, a quarter each, and a margin).
  let demand = 2 + allRooms(plan).length * 1;
  for (const r of allRooms(plan)) for (const m of r.mods) demand += Math.max(0, -(defs[m]?.power ?? 0));
  // Court bands add rooms the plan does not list (stationCourts.ts), each with its lamps and fittings; fit-out squeezes
  // in more reactors if this falls short.
  if (def.atrium?.band) demand *= 1.15;
  // Garden decks' lab benches draw power (rooms/vignettes.ts); other courts' groups take what is spare.
  if (def.atrium?.role === 'garden') demand += 30;
  // The reactor tier: the smallest the size allows that powers the station from one room of two, else the largest.
  const tiers = REACTOR_TIERS.slice(0, size === 'hub' ? 3 : size === 'station' ? 2 : 1).filter((id) => defs[id]);
  const out = (id: string): number => defs[id]?.power ?? 50;
  const id = tiers.find((t) => Math.ceil(demand / out(t)) <= 2) ?? tiers[tiers.length - 1] ?? 'module.reactor';
  const fp = defs[id]?.footprint ?? [2, 2];
  plan.reactor = { mod: id, fp: [fp[0], fp[1]] };
  plan.reactors = Math.max(1, Math.ceil(demand / out(id)) + extraReactors);
  return plan;
}
