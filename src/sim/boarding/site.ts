import { AwayC, AwaySiteC } from '../away/components';
import { DeadC } from '../crew/components';
import type { Sim } from '../sim';

/**
 * The boarding owner of away sites (#287; boarding/launch.ts opens them). A boarding site lasts while its party does: once its named party
 * has had its chance (`invited` consumed) and nobody of the party is left, out or aboard (all home, recalled, lost or left with the ship), it
 * closes and its run ends at home. Everything else is the site's own.
 */
export function boardingSiteSystem(sim: Sim): void {
  const party = new Set<number>();
  for (const c of sim.world.query(AwayC)) if (!sim.world.has(c, DeadC)) party.add(sim.world.get(c, AwayC)!.site);
  for (const ship of [...sim.world.query(AwaySiteC)].sort((a, b) => a - b)) {
    const s = sim.world.get(ship, AwaySiteC)!;
    if (s.owner === 'boarding' && s.status === 'open' && !s.invited && !party.has(ship)) s.status = 'closing';
  }
}
