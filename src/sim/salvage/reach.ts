import { reaches, startLabels, viewOf } from '../ai/navView';
import { CrewC, DeadC, PositionC } from '../crew/components';
import { isIncapacitated, origin } from '../crew/helpers';
import type { PathGoal } from '../crew/pathfind';
import { siteWalkModes } from '../eva/route';
import { AllegianceC } from '../fight/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';

/**
 * Whether any able crew member of the player's side standing on the ship could walk to a goal there, in any of the ways the scheduler
 * would try (`siteWalkModes`: suited crew across the hull ring too). Components labelling only, no search. Null while nobody of the
 * player's side is on the ship: then nothing can be judged out of reach.
 */
export function reachTest(sim: Sim, ship: number): ((goal: PathGoal) => boolean) | null {
  const tests: ((goal: PathGoal) => boolean)[] = [];
  for (const id of [...sim.world.query(CrewC, PositionC)].sort((a, b) => a - b)) {
    const pos = sim.world.get(id, PositionC)!;
    if (sim.world.has(id, DeadC) || isIncapacitated(sim, id) || sim.world.get(id, AllegianceC)?.faction !== 'player' || shipIdOf(sim, pos) !== ship) continue;
    const from = origin(pos);
    for (const m of siteWalkModes(sim, id, ship)) {
      const v = viewOf(sim, ship, m.opts);
      if (!v) continue;
      const starts = startLabels(v, from);
      tests.push((goal) => reaches(v, from, starts, goal));
    }
  }
  return tests.length ? (goal) => tests.some((t) => t(goal)) : null;
}
