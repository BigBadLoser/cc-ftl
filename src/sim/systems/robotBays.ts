import { CrewC, HealthC, NeedsC, PositionC, type Crew, type Health, type Needs, type Position } from '../crew/components';
import { isSettled } from '../crew/helpers';
import { ModuleC } from '../modules/components';
import { RobotBayC } from '../robots/components';
import { buyRepair, cradleOf, homeBay, repairItem } from '../robots/bay';
import { speciesOf } from '../robots/core';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { gridIdOf } from '../regions';

/**
 * Robot bays. A robot 'charging' in the cradle of its home bay gets `chargePerSec` battery and `repairPerSec` hp per
 * second while the bay is powered; repairs are paid one repair item at a time from the ship's storage (credit kept
 * on RobotBayC). It leaves (activity 'idle') when full and either whole or out of parts. A charging robot whose bay
 * is gone, or that is not in it, just stops charging.
 */
export function robotBaySystem(sim: Sim): void {
  for (const id of sim.world.query(CrewC, NeedsC, PositionC)) {
    const crew = sim.world.get(id, CrewC) as Crew;
    if (crew.activity !== 'charging') continue;
    const pos = sim.world.get(id, PositionC) as Position;
    const bayId = homeBay(sim, id);
    const bay = sim.world.get(bayId, ModuleC);
    const def = bay && sim.content.modules[bay.def]?.robotBay;
    if (!bay || !def || bay.hp <= 0 || gridIdOf(sim, bay) !== gridIdOf(sim, pos) || cradleOf(sim, bayId).x !== pos.x || cradleOf(sim, bayId).y !== pos.y || !isSettled(pos)) {
      crew.activity = 'idle';
      continue;
    }
    if (!bay.powered) continue; // waits in the cradle for power
    const needs = sim.world.get(id, NeedsC) as Needs;
    needs.charge = Math.min(100, (needs.charge ?? 100) + def.chargePerSec / TICK_HZ);
    const hp = sim.world.get(id, HealthC) as Health | undefined;
    let st = sim.world.get(bayId, RobotBayC);
    if (!st) sim.world.add(bayId, RobotBayC, (st = { credit: 0 }));
    let whole = !hp || hp.hp >= hp.max || !speciesOf(sim, id)?.mechanical;
    if (!whole && hp) {
      if (st.credit <= 0) st.credit += buyRepair(sim, id, gridIdOf(sim, bay));
      const amount = Math.min(st.credit, hp.max - hp.hp, def.repairPerSec / TICK_HZ);
      hp.hp += amount;
      st.credit -= amount;
      whole = hp.hp >= hp.max || (st.credit <= 0 && repairItem(sim, id, gridIdOf(sim, bay)) === null);
    }
    if (needs.charge >= 100 && whole) {
      crew.activity = 'idle';
      sim.events.emit({ type: 'robot.charged', crew: id, bay: bayId });
    }
  }
}
