import { combatReadyUnits, stepFighter } from '../fight/fighter';
import { rallySurrendered } from '../fight/surrender';
import type { Sim } from '../sim';
import { shipGrid } from '../regions';

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
    if (grid?.has('struct')) for (const id of units) stepFighter(sim, grid, id, units);
  }
  rallySurrendered(sim, all); // player crew who gave up get back up once the threat is gone
}
