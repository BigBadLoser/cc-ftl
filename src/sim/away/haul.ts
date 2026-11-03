import { JobC } from '../crew/components';
import { ItemStackC } from '../items/components';
import { makeHaul } from '../items/plan';
import { refKey, reservations } from '../items/stock';
import { shipGrid, shipIdAt } from '../regions';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { DEFAULT_CARRY_CAPACITY, PLAN_INTERVAL } from '../tuning';
import { cargoCount, cargoSpace } from '../vehicles/cargo';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { cargoTile } from '../vehicles/geometry';

/**
 * Loot on an away site (docs/DESIGN.md "Round trips, batched", #286): loose stacks become hauls into the hold of the shuttle serving the
 * site, and a full hold with loot still waiting makes a trip home due. Also the live extent of the site's hull, which the hover point follows.
 */

/** Loose loot lying on a site (delivery crates of station jobs excepted), lowest id first. */
export function looseOn(sim: Sim, ship: number): number[] {
  return [...sim.world.query(ItemStackC)].filter((id) => {
    const st = sim.world.get(id, ItemStackC)!;
    return !st.job && shipIdAt(sim, st.x, st.y) === ship;
  }).sort((a, b) => a - b);
}

/** Haul jobs carrying loot to the shuttle's hold. */
export function haulsTo(sim: Sim, vehicle: number): number[] {
  return sim.world.query(JobC).filter((j) => {
    const d = sim.world.get(j, JobC)?.haul?.dst;
    return d?.kind === 'vehicle' && d.id === vehicle;
  });
}

/**
 * Plan the party's carrying: each loose stack on the site becomes an ordinary haul job to the shuttle's hold, delivered at its staging tile
 * (`cargoTile`), as far as the hold has room after the hauls already under way. Returns the units still lying about that found no room
 * (a trip home is due when this stays above 0 with no haul under way: `runDue`).
 */
export function planCarry(sim: Sim, vehicle: number, ship: number): number {
  const v = sim.world.get(vehicle, VehicleC) as Vehicle;
  const res = reservations(sim);
  let promised = 0;
  for (const [k, n] of res.incoming) if (k.startsWith(`vehicle:${vehicle}:`)) promised += n;
  let room = cargoSpace(sim, v) - promised;
  let left = 0;
  const plan = sim.tick % PLAN_INTERVAL === 0 && !!cargoTile(sim, vehicle);
  for (const sid of looseOn(sim, ship)) {
    const s = sim.world.get(sid, ItemStackC)!;
    const avail = s.count - (res.out.get(refKey('floor', sid, s.item)) ?? 0);
    if (avail <= 0) continue;
    const fit = Math.max(0, Math.min(avail, room));
    left += avail - fit;
    room -= fit;
    if (fit > 0 && plan) makeHaul(sim, res, 'hauling', ship, { ref: { kind: 'floor', id: sid }, x: s.x, y: s.y, avail }, { kind: 'vehicle', id: vehicle }, s.item, Math.min(fit, DEFAULT_CARRY_CAPACITY));
  }
  return left;
}

/** True when the hold is full and loot is still lying about: a trip home is due to unload it. */
export function runDue(sim: Sim, vehicle: number, ship: number, unplaced: number): boolean {
  return unplaced > 0 && haulsTo(sim, vehicle).length === 0 && cargoCount(sim.world.get(vehicle, VehicleC) as Vehicle) > 0 && looseOn(sim, ship).length > 0;
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
