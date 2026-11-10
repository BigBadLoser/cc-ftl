import { CrewC, PositionC, PrioritiesC, type Sim } from '../sim';
import { isIncapacitated } from '../sim/crew/helpers';
import { shipIdOf } from '../sim/regions';
import { OPERATE_MAX_LEVEL } from '../sim/tuning';

/**
 * Why a powered console has nobody on it, in a few words for the Stations strip, or null when no reason is worth saying (a hand is already
 * walking there, or the console is a weapons or helm one that stand-in crew will take). Consoles are manned by crew whose operating
 * priority is 1 or 2; stand-ins (engineers, medics) relieve only the weapons and helm, never the shield console (docs/DESIGN.md, "Consoles").
 */
export function emptyConsoleReason(sim: Sim, ship: number, kind: 'weapons' | 'shields' | 'helm'): string | null {
  let aboard = 0;
  let operators = 0;
  for (const id of sim.world.query(CrewC, PrioritiesC, PositionC)) {
    const at = sim.world.get(id, PositionC);
    if (!at || shipIdOf(sim, at) !== ship || isIncapacitated(sim, id)) continue;
    aboard++;
    const level = sim.world.get(id, PrioritiesC)?.operating ?? 0;
    if (level >= 1 && level <= OPERATE_MAX_LEVEL) operators++;
  }
  if (aboard === 0) return 'no crew aboard';
  if (kind !== 'shields') return null;
  return operators === 0 ? 'nobody has Operating priority 1 or 2 (stand-ins never take shields)' : 'crew with Operating priority 1 or 2 are at other posts (stand-ins never take shields)';
}
