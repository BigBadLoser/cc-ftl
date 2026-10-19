import { shipOf } from '../combat/ships';
import { ItemStackC } from '../items/components';
import { makeHaul } from '../items/plan';
import { nearestStorageFor, refKey, reservations, type Reservations } from '../items/stock';
import type { Sim } from '../sim';
import { DEFAULT_CARRY_CAPACITY, PLAN_INTERVAL } from '../tuning';
import { cargoSpace } from '../vehicles/cargo';
import { VehicleC } from '../vehicles/components';
import { boardingTile, cargoTile } from '../vehicles/geometry';

/** Units already promised to a vehicle's hold by pending hauls. */
function promised(res: Reservations, vehicle: number): number {
  let n = 0;
  for (const [k, v] of res.incoming) if (k.startsWith(`vehicle:${vehicle}:`)) n += v;
  return n;
}

/**
 * Shuttle cargo hauling, planned like the other hauls (it runs before the floor-clearing planner so it gets first
 * claim). LOAD: loose stacks on a prize ship go to a shuttle stowed or docked on that grid (nowhere else to put them).
 * UNLOAD: a shuttle with cargo at a boarding tile on a live player ship is emptied into the nearest storage that
 * accepts each item. At a docking airlock both go through its unloaders: crew work the keep-out tile in front of a chute. Crew do the walking as ordinary 'hauling' jobs; the pilot stays at the controls.
 * A hold sealed by a trade (`Vehicle.outbound`: goods waiting to be sold) is never unloaded here; the trade system loads it.
 */
export function cargoJobsSystem(sim: Sim): void {
  if (sim.tick % PLAN_INTERVAL !== 0) return;
  const res = reservations(sim);
  for (const id of sim.world.query(VehicleC)) {
    const v = sim.world.get(id, VehicleC);
    const at = v && boardingTile(sim, id);
    const ship = at && shipOf(sim, at.gridId);
    if (!v || !at || !ship) continue;
    if (ship.state === 'prize') {
      for (const sid of sim.world.query(ItemStackC)) {
        const s = sim.world.get(sid, ItemStackC);
        if (!s || s.gridId !== at.gridId) continue;
        const avail = s.count - (res.out.get(refKey('floor', sid, s.item)) ?? 0);
        const room = cargoSpace(sim, v) - promised(res, id);
        if (avail <= 0 || room <= 0) continue;
        const src = { ref: { kind: 'floor' as const, id: sid }, x: s.x, y: s.y, avail };
        makeHaul(sim, res, 'hauling', at.gridId, src, { kind: 'vehicle', id }, s.item, Math.min(avail, room, DEFAULT_CARRY_CAPACITY));
      }
    } else if (ship.faction === 'player' && (ship.state === 'active' || ship.state === 'disabled') && !v.outbound) {
      for (const q of v.cargo) {
        const avail = q.count - (res.out.get(refKey('vehicle', id, q.item)) ?? 0);
        if (avail <= 0) continue;
        // Cargo comes out through the airlock's unloaders: crew take it at the keep-out tile nearest the storage.
        const dest = nearestStorageFor(sim, at.gridId, q.item, cargoTile(sim, id) ?? at, res);
        if (!dest) continue;
        const stand = cargoTile(sim, id, dest) ?? at;
        const src = { ref: { kind: 'vehicle' as const, id }, x: stand.x, y: stand.y, avail };
        makeHaul(sim, res, 'hauling', at.gridId, src, dest.ref, q.item, Math.min(avail, dest.room, DEFAULT_CARRY_CAPACITY));
      }
    }
  }
}
