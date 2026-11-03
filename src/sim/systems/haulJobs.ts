import { AwaySiteC } from '../away/components';
import { shipIdAt, shipIdOf } from '../regions';
import { ItemStackC } from '../items/components';
import { makeHaul, warnDue } from '../items/plan';
import { isCargo } from '../items/stacks';
import { nearestStorageFor, refKey, reservations } from '../items/stock';
import type { Sim } from '../sim';
import { DEFAULT_CARRY_CAPACITY, PLAN_INTERVAL } from '../tuning';

/**
 * Clears the floor: every loose stack not already claimed gets a haul job to the nearest storage
 * module that accepts the item and has room (counting space already promised to other hauls).
 * With nowhere to put it, a debounced 'storage.full' event is emitted for that stack. Loot on an away site is not for the
 * site's own storage: the site's party hauls it into the site's staging zone (away/haul.ts `planCarry`).
 */
export function haulJobsSystem(sim: Sim): void {
  if (sim.tick % PLAN_INTERVAL !== 0) return;
  const res = reservations(sim);
  for (const id of sim.world.query(ItemStackC)) {
    const stack = sim.world.get(id, ItemStackC);
    if (!stack || isCargo(sim, stack.item) || partyLoot(sim, shipIdAt(sim, stack.x, stack.y))) continue;
    const avail = stack.count - (res.out.get(refKey('floor', id, stack.item)) ?? 0);
    if (avail <= 0) continue;
    const dest = nearestStorageFor(sim, shipIdAt(sim, stack.x, stack.y), stack.item, stack, res);
    if (!dest) {
      if (warnDue(sim, stack)) {
        sim.events.emit({ type: 'storage.full', ship: shipIdOf(sim, stack), x: stack.x, y: stack.y, item: stack.item });
      }
      continue;
    }
    const src = { ref: { kind: 'floor' as const, id }, x: stack.x, y: stack.y, avail };
    makeHaul(sim, res, 'hauling', shipIdAt(sim, stack.x, stack.y), src, dest.ref, stack.item, Math.min(avail, dest.room, DEFAULT_CARRY_CAPACITY));
  }
}

/** Loose items on a site whose party carries its loot off (away/haul.ts) are theirs, not the ship's haulers' (a `noLoot` site, such as a yard
 * order on the player's own ship, leaves the ship's hauling alone). */
const partyLoot = (sim: Sim, ship: number): boolean => {
  const site = sim.world.get(ship, AwaySiteC);
  return !!site && !site.noLoot;
};
