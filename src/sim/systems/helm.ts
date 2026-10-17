import { CombatC, IonC, ShipC } from '../combat/components';
import { mannedConsole, skillOf } from '../combat/operators';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { EVASION_CAP, FTL_CHARGE_SEC, SKILL_STEP } from '../tuning';

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
    const pilot = ship.state === 'active' ? mannedConsole(sim, ship.gridId, 'helm') : null;
    let engines = 0;
    if (pilot) {
      for (const mid of sim.world.query(ModuleC)) {
        const m = sim.world.get(mid, ModuleC);
        const eng = m && m.gridId === ship.gridId ? sim.content.modules[m.def]?.engine : undefined;
        if (!m || !eng || !m.powered || m.hp <= 0 || sim.world.has(mid, IonC)) continue;
        engines += Math.abs(sim.content.modules[m.def]?.power ?? 0) * eng.evasionPerPower;
      }
    }
    const boost = pilot ? 1 + SKILL_STEP * skillOf(sim, pilot.crew, 'piloting') : 0;
    combat.evasion = Math.min(EVASION_CAP, engines * boost);
    if (pilot && engines > 0) combat.ftl = Math.min(FTL_CHARGE_SEC, combat.ftl + boost / TICK_HZ);
  }
}
