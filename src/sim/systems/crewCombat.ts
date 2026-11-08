import { combatReadyUnits, stepFighter } from '../fight/fighter';
import { rallySurrendered } from '../fight/surrender';
import type { Sim } from '../sim';
import { shipGrid } from '../regions';
import { isBreaking } from '../crew/helpers';
import { mayHaveHostilePair } from '../fight/relations';

/**
 * Crew-vs-crew combat, once per tick, after decisions and before movement (so the paths it sets are walked at once).
 * Per crew member, in id order: pick a target (the player's order, else the nearest visible hostile; boarders and
 * security also hunt unseen ones), close in, attack when in reach, flee if unarmed and not a fighter, surrender when
 * beaten, or walk to a bridge console when a boarder has nobody left to fight. All details in fight/fighter.ts.
 */
export function crewCombatSystem(sim: Sim): void {
  const all = combatReadyUnits(sim);
  for (const [shipId, units] of all) {
    const grid = shipGrid(sim, shipId);
    if (!grid?.has('struct')) continue;
    // No two of them can be hostile (checked now: fights on ships before this one may have changed sides or wanted marks): nobody's foe
    // list can fill, and a turn without foes changes no allegiance or wanted mark, so every turn of this ship skips the search.
    const peaceful = !mayHaveHostilePair(sim, units);
    for (const id of units) if (!isBreaking(sim, id)) stepFighter(sim, grid, id, units, peaceful); // a break's machine steers the broken
  }
  rallySurrendered(sim, all); // player crew who gave up get back up once the threat is gone
}
