import { abortTask } from '../ai/task';
import { CrewC, DeadC, DraftedC, PositionC, type Crew } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { regionAirlock } from '../ferry/pick';
import type { Sim } from '../sim';
import { VehicleC } from '../vehicles/components';
import { bayWorking } from '../vehicles/geometry';
import { AwayC } from './components';
import { siteUnderFoot } from './crew';
import { atHome } from './phase';

/** What became of a recall order: who was called home, by site run, and who could not be, with the reason. */
export interface Recalled {
  /** The crew called home, by the shuttle serving their site (ascending ids). */
  sent: Map<number, number[]>;
  /** Those who could not be: not of a party out on its site (`notAboard`), downed (`incapacitated`), gone (`noCrew`), or their shuttle has no
   * way home (`noHome`). */
  left: { crew: number; reason: string }[];
}

/**
 * Why a crew member cannot be called home, or null: gone (`noCrew`), not of a party out on its site (`notAboard`), downed (`incapacitated`),
 * or the shuttle serving their site has no way home (`noHome`: its bay is down and no airlock of the home ship is free, or the home ship is
 * gone), so the recall would leave them sitting in a shuttle with nowhere to go. They stay where they are, and the site goes on.
 */
export function notRecallable(sim: Sim, c: number): string | null {
  if (!sim.world.has(c, CrewC) || sim.world.has(c, DeadC) || !sim.world.has(c, PositionC)) return 'noCrew';
  const away = sim.world.get(c, AwayC);
  if (!away || !siteUnderFoot(sim, c)) return 'notAboard';
  if (isIncapacitated(sim, c)) return 'incapacitated';
  return wayHome(sim, away.vehicle) ? null : 'noHome';
}

/** Can the shuttle get home: it is there, its bay works, or an airlock of its home ship is free. A lost shuttle counts (another takes over). */
function wayHome(sim: Sim, id: number): boolean {
  const v = sim.world.get(id, VehicleC);
  return !v || atHome(sim, v) || (!!v.home && bayWorking(sim, v.home)) || regionAirlock(sim, v.homeShip, id) !== 0;
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
