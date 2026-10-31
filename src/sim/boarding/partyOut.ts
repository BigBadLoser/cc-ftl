import { CrewC, DeadC, PositionC } from '../crew/components';
import { isSubdued } from '../fight/relations';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { AboardC } from '../vehicles/components';

/**
 * Is a boarding party actually away from its ship: a live member riding the shuttle or standing on another ship? A launch that was dropped
 * leaves them home. `active` counts only members still in the fight (not surrendered, downed or inert). Shared by the enemy AI (a raider
 * holds fire while its party is out) and the hopeless check (a ship whose party is still fighting elsewhere has not lost).
 */
export function partyOut(sim: Sim, shipId: number, crew: readonly number[], active = false): boolean {
  return crew.some((c) => {
    if (!sim.world.has(c, CrewC) || sim.world.has(c, DeadC) || (active && isSubdued(sim, c))) return false;
    const pos = sim.world.get(c, PositionC);
    return pos ? shipIdOf(sim, pos) !== shipId : sim.world.has(c, AboardC);
  });
}
