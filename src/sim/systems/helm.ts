import { CombatC, IonC, ShipC } from '../combat/components';
import { CrewC, PositionC } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { mannedConsole, skillOf } from '../combat/operators';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { EVASION_CAP, FTL_CHARGE_SEC, SKILL_STEP } from '../tuning';
import { shipIdOf } from '../regions';

/**
 * Evasion and the FTL drive. Both need a pilot at a powered helm. Evasion is the sum of powered engines'
 * |power| x evasionPerPower (capped), scaled up by pilot skill; it is 0 with no pilot or no engine power.
 * The drive charges (to FTL_CHARGE_SEC) only while a pilot is in and at least one engine runs.
 */
export function helmSystem(sim: Sim): void {
  for (const id of sim.world.query(ShipC, CombatC)) {
    const ship = sim.world.get(id, ShipC);
    const combat = sim.world.get(id, CombatC);
    if (!ship || !combat) continue;
    const pilot = ship.state === 'active' ? mannedConsole(sim, id, 'helm') : null;
    let engines = 0;
    if (pilot) {
      for (const mid of sim.world.query(ModuleC)) {
        const m = sim.world.get(mid, ModuleC);
        const eng = m && shipIdOf(sim, m) === id ? sim.content.modules[m.def]?.engine : undefined;
        if (!m || !eng || !m.powered || m.hp <= 0 || sim.world.has(mid, IonC)) continue;
        engines += Math.abs(sim.content.modules[m.def]?.power ?? 0) * eng.evasionPerPower;
      }
    }
    const skill = pilot ? Math.max(0, skillOf(sim, pilot.crew, 'piloting')) : 0;
    const boost = pilot ? 1 + SKILL_STEP * skill : 0;
    combat.pilot = skill;
    combat.evasion = Math.min(EVASION_CAP, engines * boost);
    if (ship.faction === 'player' && sim.tick % CRUISE_EVERY === 0) cruise(sim, id, combat);
    if (pilot && engines > 0) combat.ftl = Math.min(FTL_CHARGE_SEC, combat.ftl + boost / TICK_HZ);
  }
}

/** How often (ticks) a player ship's cruise figures are refreshed. */
const CRUISE_EVERY = 10;

/**
 * The evade figures of a ship under way (see `Combat.cruisePilot`): the best piloting skill among the crew on their feet aboard, and the powered engines
 * of an intact, powered helm's ship boosted by it. With a manned helm the combat figures are used instead.
 */
function cruise(sim: Sim, id: number, combat: { cruisePilot: number; cruiseEvasion: number }): void {
  combat.cruisePilot = 0;
  combat.cruiseEvasion = 0;
  if (sim.world.get(id, ShipC)?.state !== 'active') return;
  let helm = false;
  let engines = 0;
  for (const mid of sim.world.query(ModuleC)) {
    const m = sim.world.get(mid, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def || !m.powered || m.hp <= 0 || sim.world.has(mid, IonC) || shipIdOf(sim, m) !== id) continue;
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
