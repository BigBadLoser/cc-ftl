import { CrewC, PositionC } from '../crew/components';
import { AllegianceC } from '../fight/components';
import { isSubdued } from '../fight/relations';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { FTL_CHARGE_SEC, HOPELESS_HULL } from '../tuning';
import { CombatC, type Ship } from './components';
import { isDormant } from './dormant';
import { partyOut } from '../boarding/partyOut';
import { BoarderC } from '../vehicles/components';

/**
 * Has a hostile ship's fight become hopeless (issue #225)? All of:
 * - its hull is failing: integrity below HOPELESS_HULL;
 * - its weapons are dead: no weapon module that is intact and powered;
 * - it cannot run: its drive is not charged (a charged one flees instead);
 * - it has no boarding party still fighting away from it (`partyOut`): that party could still take the player's ship;
 * - its crew are cut off or outnumbered: no player crew aboard to fight (they can only wait to be shot to pieces), or more able player crew
 *   aboard than able crew of its own.
 * Then its crew give up through the ordinary surrender path. Only crewed hostile ships (as `crewSubdued`): not rogue machines, dens asleep or
 * outposts; fearless species are left to the caller to skip.
 */
export function hopeless(sim: Sim, shipId: number, ship: Ship): boolean {
  const crewed = ship.faction === 'hostile' || (ship.faction === 'rogue' && !!ship.gen && !!sim.content.factions?.[ship.gen.faction]?.living);
  if (!crewed || ship.outpost || isDormant(ship) || ship.integrity >= HOPELESS_HULL) return false;
  // A ship whose boarding party is still fighting away from it (on the player's ship, or in the shuttle) has not lost: that party may yet
  // take the player's ship, which needs the fight to go on (captureSystem runs only in combat).
  const party = sim.world.get(shipId, BoarderC)?.crew;
  if (party && partyOut(sim, shipId, party, true)) return false;
  // A ship that can still run (its drive charged) runs rather than gives up: the enemy AI flees it (enemyAi.ts).
  if ((sim.world.get(shipId, CombatC)?.ftl ?? 0) >= FTL_CHARGE_SEC) return false;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (m && m.hp > 0 && m.powered && sim.content.modules[m.def]?.weapon && shipIdOf(sim, m) === shipId) return false;
  }
  let own = 0;
  let boarders = 0;
  for (const id of sim.world.query(CrewC, PositionC)) {
    if (shipIdOf(sim, sim.world.get(id, PositionC)) !== shipId || isSubdued(sim, id)) continue;
    if (sim.world.get(id, AllegianceC)?.faction === 'player') boarders++;
    else own++;
  }
  return own > 0 && (boarders === 0 || boarders > own);
}
