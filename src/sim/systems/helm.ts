import { CombatC, IonC, ShipC } from '../combat/components';
import { overchargeActive } from '../combat/heat';
import { OVERCHARGE_ENGINE_EVASION } from '../combat/heatTuning';
import { mannedConsole, skillOf } from '../combat/operators';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { EVASION_CAP, FTL_CHARGE_SEC, SKILL_STEP, XP_PER_WORK_SEC } from '../tuning';
import { grantXp } from '../crew/xp';
import { modulesOn, type DefTest } from '../modules/byShip';
import { settleDeparture, settleOrder } from '../ftl/order';
import { refreshCruise } from '../combat/cruise';

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
      for (const mid of modulesOn(sim, id, isEngine)) {
        const m = sim.world.get(mid, ModuleC);
        const eng = m && sim.content.modules[m.def]?.engine;
        if (!m || !eng || !m.powered || m.hp <= 0 || sim.world.has(mid, IonC)) continue;
        engines += Math.abs(sim.content.modules[m.def]?.power ?? 0) * eng.evasionPerPower;
      }
    }
    const skill = pilot ? Math.max(0, skillOf(sim, pilot.crew, 'piloting')) : 0;
    const boost = pilot ? 1 + SKILL_STEP * skill : 0;
    combat.pilot = skill;
    combat.evasion = Math.min(EVASION_CAP, engines * boost + (pilot && engines > 0 && overchargeActive(combat, 'engines') ? OVERCHARGE_ENGINE_EVASION : 0));
    if (ship.faction === 'player' && sim.tick % CRUISE_EVERY === 0) refreshCruise(sim, id, combat);
    // Piloting XP only while the helm matters: evading in a fight, or the drive actually charging. A seated pilot with a full drive in peacetime learns nothing.
    if (pilot && engines > 0 && (sim.sector.inCombat || combat.ftl < FTL_CHARGE_SEC)) grantXp(sim, pilot.crew, 'piloting', XP_PER_WORK_SEC / TICK_HZ);
    if (pilot && engines > 0) combat.ftl = Math.min(FTL_CHARGE_SEC, combat.ftl + boost / TICK_HZ);
    if (combat.ftlOrder) settleOrder(sim, id);
    if (combat.departHold) settleDeparture(sim, id);
  }
}

const isEngine: DefTest = (d) => !!d.engine;

/** How often (ticks) a player ship's cruise figures are refreshed. */
const CRUISE_EVERY = 10;
