import { IonC, ShipC } from './components';
import { CrewC, PositionC } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { skillOf } from './operators';
import { ModuleC } from '../modules/components';
import { modulesOn, type DefTest } from '../modules/byShip';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { EVASION_CAP, SKILL_STEP } from '../tuning';

const isHelmOrEngine: DefTest = (d) => d.console === 'helm' || !!d.engine;

/**
 * The evade figures of a ship under way (see `Combat.cruisePilot`): the best piloting skill among the crew on their feet aboard, and the powered engines
 * of an intact, powered helm's ship boosted by it. With a manned helm the combat figures are used instead. The helm system refreshes them
 * every few ticks; a ship leaving for hyperspace refreshes them as it goes, since the evade odds of the trip read them from its packet (#367).
 */
export function refreshCruise(sim: Sim, id: number, combat: { cruisePilot: number; cruiseEvasion: number }): void {
  combat.cruisePilot = 0;
  combat.cruiseEvasion = 0;
  if (sim.world.get(id, ShipC)?.state !== 'active') return;
  let helm = false;
  let engines = 0;
  for (const mid of modulesOn(sim, id, isHelmOrEngine)) {
    const m = sim.world.get(mid, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def || !m.powered || m.hp <= 0 || sim.world.has(mid, IonC)) continue;
    if (def.console === 'helm') helm = true;
    if (def.engine) engines += Math.abs(def.power ?? 0) * def.engine.evasionPerPower;
  }
  if (!helm || engines <= 0) return;
  let best = 0;
  for (const cid of sim.world.query(CrewC)) {
    const pos = sim.world.get(cid, PositionC);
    if (!pos || shipIdOf(sim, pos) !== id || isIncapacitated(sim, cid)) continue;
    if (sim.world.get(cid, CrewC)?.activity === 'sleeping') continue;
    best = Math.max(best, skillOf(sim, cid, 'piloting'));
  }
  combat.cruisePilot = best;
  combat.cruiseEvasion = Math.min(EVASION_CAP, engines * (1 + SKILL_STEP * best));
}
