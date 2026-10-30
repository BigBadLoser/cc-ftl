import { AssignmentC, CrewC, DeadC, DownedC, DraftedC, JobC, PositionC } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { combatReadyUnits } from '../fight/fighter';
import { sightLine } from '../fight/los';
import { isCombatReady, isHostile } from '../fight/relations';
import { ModuleC } from '../modules/components';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { COMBAT_SIGHT } from '../tuning';
import { SabotageOrderC } from './components';
import { endOrder, planSabotage, startSabotageJob } from './sabotage';

/** Is a combat-ready hostile within sight (range and clear line) of this boarder? The same test crew combat uses to pick a target. */
function hostileInSight(sim: Sim, crew: number, units: readonly number[]): boolean {
  const pos = sim.world.get(crew, PositionC);
  const grid = pos && shipGrid(sim, shipIdOf(sim, pos));
  if (!pos || !grid) return false;
  for (const o of units) {
    const p = sim.world.get(o, PositionC);
    if (o === crew || !p || !isHostile(sim, crew, o) || !isCombatReady(sim, o)) continue;
    if (Math.hypot(pos.x - p.x, pos.y - p.y) <= COMBAT_SIGHT && sightLine(sim, grid, pos, p).visible) return true;
  }
  return false;
}

/**
 * Sabotage orders paused by a fight (boarders with a `SabotageOrderC` and no sabotage job). Each one ends for good if the module is
 * gone, the boarder is downed or dead, no longer drafted and standing by, or off the module's ship. Otherwise, once no hostile is in
 * sight and the boarder is able and idle, the job is posted again and the walk restarts (`crew.sabotageResumed`). Runs after the
 * autojobs system, which is what pauses them.
 */
export function sabotageResumeSystem(sim: Sim): void {
  const ready = combatReadyUnits(sim);
  for (const crew of sim.world.query(SabotageOrderC)) {
    const order = sim.world.get(crew, SabotageOrderC)!;
    const a = sim.world.get(crew, AssignmentC);
    const m = sim.world.get(order.module, ModuleC);
    const pos = sim.world.get(crew, PositionC);
    const drafted = sim.world.get(crew, DraftedC);
    if (!sim.world.has(crew, CrewC) || sim.world.has(crew, DeadC)) {
      sim.world.remove(crew, SabotageOrderC);
    } else if (!m || m.hp <= 0) endOrder(sim, crew, order.module, 'destroyed');
    else if (sim.world.has(crew, DownedC)) endOrder(sim, crew, order.module, 'downed');
    else if (a && sim.world.get(a.jobId, JobC)?.kind !== 'sabotage') endOrder(sim, crew, order.module, 'interrupted'); // given another job
    else if (!pos || !drafted || drafted.target !== null || shipIdOf(sim, pos) !== shipIdOf(sim, m)) endOrder(sim, crew, order.module, 'interrupted');
    else if (!a && !isIncapacitated(sim, crew) && !hostileInSight(sim, crew, ready.get(shipIdOf(sim, pos)) ?? [])) {
      const plan = planSabotage(sim, crew, order.module);
      if (!plan) endOrder(sim, crew, order.module, 'interrupted');
      else {
        startSabotageJob(sim, crew, order.module, plan);
        sim.events.emit({ type: 'crew.sabotageResumed', crew, module: order.module, ship: shipIdOf(sim, m) });
      }
    }
  }
}
