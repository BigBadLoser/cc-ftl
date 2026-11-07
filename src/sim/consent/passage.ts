import { abortTask } from '../ai/task';
import { DraftedC, PrioritiesC, WORK_CATEGORIES, type Priorities, type WorkCategory } from '../crew/components';
import { AllegianceC } from '../fight/components';
import type { Sim } from '../sim';
import { grant } from './guests';

/**
 * Passengers (DESIGN.md "Physical encounters": passengers; #173 step 6). A passenger is a person aboard the player's ship who is not crew: a lodging guest
 * by a 'passage' grant (consent/components.ts). They own a bed, eat and sleep as the crew do and pitch in with a few chores at the lowest priority; they
 * are never drafted (`crew.draft` refuses), armed or sent out, and in a fight they act as any unarmed non-combatant (they flee). Where they are going and
 * what they pay is a passage job's (galaxy/), not theirs.
 */

/** The work a passenger pitches in with, all at the lowest priority (4): fetching and carrying, and the galley. */
export const PASSENGER_CHORES: readonly WorkCategory[] = ['hauling', 'cooking'];

function chores(): Priorities {
  const p = Object.fromEntries(WORK_CATEGORIES.map((c) => [c, 0])) as unknown as Priorities;
  for (const c of PASSENGER_CHORES) p[c] = 4;
  return p;
}

/** Take the person aboard `ship` as a passenger: a lodging, working 'passage' grant naming them, and the passenger's chores as their priorities. */
export function takePassenger(sim: Sim, ship: number, crew: number): void {
  const faction = sim.world.get(crew, AllegianceC)?.faction;
  if (!faction || faction === 'player') return;
  if (sim.world.has(crew, DraftedC)) {
    sim.world.remove(crew, DraftedC);
    abortTask(sim, crew, 'drafted');
  }
  sim.world.add(crew, PrioritiesC, chores());
  grant(sim, ship, { by: 'passage', faction, crew: [crew], lodge: true, work: true });
}
