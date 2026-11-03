import { ItemStackC, StagingC } from '../items/components';
import { makeHaul } from '../items/plan';
import { refKey, reservations } from '../items/stock';
import { shipGrid, shipIdAt } from '../regions';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { isStaged, loadCrate, stagedStacks, stagingRoom, zoneIntact, zoneTilesNear } from '../items/staging';
import { TICK_HZ } from '../time';
import { DEFAULT_CARRY_CAPACITY, LOAD_CRATE_SEC, PLAN_INTERVAL, STAGING_LOADS, STAGING_TILES } from '../tuning';
import { cargoCount, cargoSpace } from '../vehicles/cargo';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { vehicleDefOf } from '../vehicles/lifecycle';

/** Seconds between looks at a staging zone that is short of tiles or lost one. */
const ZONE_LOOK_SEC = 5;

/**
 * Loot on an away site (docs/ARCHITECTURE.md "Away sites and the air drive", "Staging", #286): the site keeps a staging zone beside its
 * shuttle's drop-off point; the party hauls loose loot into it (ordinary hauls, gathered several stacks a trip), whether the shuttle is there
 * or away, and the shuttle, while at the site, loads it into its hold a crate at a time. A full hold makes a trip home due. Also the live
 * extent of the site's hull, which the hover point follows.
 */

/** Loot lying on a site, in its staging zone or not (delivery crates of station jobs excepted), lowest id first. */
export function looseOn(sim: Sim, ship: number): number[] {
  return [...sim.world.query(ItemStackC)].filter((id) => {
    const st = sim.world.get(id, ItemStackC)!;
    return !st.job && shipIdAt(sim, st.x, st.y) === ship;
  }).sort((a, b) => a - b);
}

/** Loot lying on a site outside its staging zone: what is still to be hauled. */
export const unstagedOn = (sim: Sim, ship: number): number[] => looseOn(sim, ship).filter((id) => !isStaged(sim, sim.world.get(id, ItemStackC)!));

/**
 * Keep the site's staging zone (the site's, away/owned.ts): STAGING_TILES tiles beside the shuttle's drop-off point (`spot`: the hatch spot
 * while hovering, the docked airlock's inside tile), holding STAGING_LOADS hold loads. Made the first time the shuttle is at the site; while
 * it is short of tiles (a sealed hull: only a few are in reach at first) or a tile can no longer hold goods (stripped or built on), it is
 * looked at again every ZONE_LOOK_SEC: its tiles that still hold goods stay, in their order, and the nearest new ones fill it up.
 */
export function keepZone(sim: Sim, ship: number, vehicle: number, spot: { x: number; y: number }): void {
  const z = sim.world.get(ship, StagingC);
  if (z && z.tiles.length >= STAGING_TILES && zoneIntact(sim, ship, z)) return;
  if (z && sim.tick % Math.round(ZONE_LOOK_SEC * TICK_HZ) !== 0) return;
  const keep = z ? z.tiles.filter((t) => zoneIntact(sim, ship, { tiles: [t], cap: 0 })) : [];
  const near = zoneTilesNear(sim, ship, spot, STAGING_TILES).filter((t) => !keep.some((k) => k.x === t.x && k.y === t.y));
  const tiles = [...keep, ...near].slice(0, STAGING_TILES);
  const v = sim.world.get(vehicle, VehicleC);
  const hold = (v && vehicleDefOf(sim, v)?.cargo) ?? 0;
  if (tiles.length === 0) sim.world.remove(ship, StagingC);
  else sim.world.add(ship, StagingC, { tiles, cap: STAGING_LOADS * hold });
}

/** Plan the party's carrying: each loose stack outside the zone becomes an ordinary haul into the zone, as far as the zone has room. */
export function planCarry(sim: Sim, ship: number): void {
  if (sim.tick % PLAN_INTERVAL !== 0 || !sim.world.has(ship, StagingC)) return;
  const res = reservations(sim);
  for (const sid of unstagedOn(sim, ship)) {
    const s = sim.world.get(sid, ItemStackC)!;
    const avail = s.count - (res.out.get(refKey('floor', sid, s.item)) ?? 0);
    const fit = Math.min(avail, stagingRoom(sim, ship, s.item, res), DEFAULT_CARRY_CAPACITY);
    if (fit > 0) makeHaul(sim, res, 'hauling', ship, { ref: { kind: 'floor', id: sid }, x: s.x, y: s.y, avail }, { kind: 'zone', id: ship }, s.item, fit);
  }
}

/** Load the shuttle at the site: one crate from the zone every LOAD_CRATE_SEC since it arrived (`arrived`: that tick). */
export function loadStep(sim: Sim, ship: number, vehicle: number, arrived: number): void {
  const t = sim.tick - arrived;
  if (t > 0 && t % Math.max(1, Math.round(LOAD_CRATE_SEC * TICK_HZ)) === 0) loadCrate(sim, ship, vehicle);
}

/** True while the shuttle has loading to do: goods in the zone and room in the hold. */
export function loading(sim: Sim, ship: number, vehicle: number): boolean {
  const v = sim.world.get(vehicle, VehicleC) as Vehicle;
  return cargoSpace(sim, v) > 0 && stagedStacks(sim, ship).length > 0;
}

/** True when the hold is full: a trip home is due to unload it. */
export function runDue(sim: Sim, vehicle: number): boolean {
  const v = sim.world.get(vehicle, VehicleC) as Vehicle;
  return cargoCount(v) > 0 && cargoSpace(sim, v) === 0;
}

/** The bounds (sector tiles) of what still stands of a ship: its tiles that are not open space. Null when nothing is left. */
export function liveBox(sim: Sim, ship: number): { x: number; y: number; w: number; h: number } | null {
  const grid = shipGrid(sim, ship);
  if (!grid) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
    for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
      if (grid.get('ship', x, y) !== ship || grid.get('struct', x, y) === Struct.Space) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  return x1 < x0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
