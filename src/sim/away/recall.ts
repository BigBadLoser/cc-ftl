import { abortTask } from '../ai/task';
import { CrewC, DeadC, DraftedC, PositionC, type Crew } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import type { Sim } from '../sim';
import { AwayC } from './components';
import { siteUnderFoot } from './crew';

/** What became of a recall order: who was called home, by site run, and who could not be, with the reason. */
export interface Recalled {
  /** The crew called home, by the shuttle serving their site (ascending ids). */
  sent: Map<number, number[]>;
  /** Those who could not be: not of a party out on its site (`notAboard`), downed (`incapacitated`), or gone (`noCrew`). */
  left: { crew: number; reason: string }[];
}

/** Why a crew member cannot be called home, or null: gone (`noCrew`), not of a party out on its site (`notAboard`), downed (`incapacitated`). */
export function notRecallable(sim: Sim, c: number): string | null {
  if (!sim.world.has(c, CrewC) || sim.world.has(c, DeadC) || !sim.world.has(c, PositionC)) return 'noCrew';
  if (!sim.world.has(c, AwayC) || !siteUnderFoot(sim, c)) return 'notAboard';
  return isIncapacitated(sim, c) ? 'incapacitated' : null;
}

/**
 * `crew.recall` (docs/DESIGN.md "Boarding in ship combat", #287): the player calls members of an away party home. Each one out on their site
 * is let go of any order (undrafted) and marked `Away.recall`: the return drive takes them aboard at once (away/crew.ts `awayReturn`), and
 * the trip that carries them leaves at once too (`passengerUrgent`). The site's run does the rest: home, then back for whoever stays.
 */
export function recallCrew(sim: Sim, ids: readonly number[]): Recalled {
  const out: Recalled = { sent: new Map(), left: [] };
  for (const c of [...new Set(ids)].sort((a, b) => a - b)) {
    const reason = notRecallable(sim, c);
    const away = sim.world.get(c, AwayC);
    if (reason || !away) {
      out.left.push({ crew: c, reason: reason ?? 'notAboard' });
      continue;
    }
    abortTask(sim, c, 'order');
    if (sim.world.remove(c, DraftedC)) (sim.world.get(c, CrewC) as Crew).activity = 'idle';
    away.recall = true;
    const list = out.sent.get(away.vehicle) ?? [];
    list.push(c);
    out.sent.set(away.vehicle, list);
  }
  return out;
}
