import { CombatC, ShipC } from '../combat/components';
import { OVERCHARGE_SYSTEMS, passiveCooling, ventRadiatorCooling, addHeat, shieldsDown } from '../combat/heat';
import { IDLE_COOL_PER_SEC, LOCKOUT_EXIT_HEAT, OVERCHARGE_HEAT_PER_SEC, VENT_COOL_PER_SEC, VENT_SEC } from '../combat/heatTuning';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';

/**
 * Combat heat per tick (rules in combat/heat.ts). Timers run down (vent, lockout, overcharge and its cooldown); an overcharge adds
 * heat per second while active. Heat falls only in one of three ways: out of combat (the hull sheds it), while venting, or while
 * the shields are down (0 layers: passive cooling plus radiators). The lockout ends with heat clamped to LOCKOUT_EXIT_HEAT.
 * Runs before the shield system, so a vent or lockout started this tick already holds the shields down.
 */
export function heatSystem(sim: Sim): void {
  for (const id of sim.world.query(ShipC, CombatC)) {
    const c = sim.world.get(id, CombatC);
    const ship = sim.world.get(id, ShipC);
    if (!c || !ship) continue;
    const h = c.heat;
    for (const sys of OVERCHARGE_SYSTEMS) {
      const o = h.overcharge[sys];
      if (o.cooldown > 0) o.cooldown--;
      if (o.left > 0) {
        o.left--;
        addHeat(sim, id, OVERCHARGE_HEAT_PER_SEC[sys] / TICK_HZ);
      }
    }
    if (h.value <= 0 && h.lockout === 0 && h.vent === 0) continue;
    if (!sim.sector.inCombat || ship.state !== 'active') {
      h.value = Math.max(0, h.value - IDLE_COOL_PER_SEC / TICK_HZ);
      h.lockout = 0;
      h.vent = 0;
      continue;
    }
    if (h.lockout > 0) {
      h.value = Math.max(0, h.value - passiveCooling(sim, id) / TICK_HZ);
      if (--h.lockout === 0) h.value = Math.min(h.value, LOCKOUT_EXIT_HEAT);
    } else if (h.vent > 0) {
      h.vent--;
      h.value = Math.max(0, h.value - (VENT_COOL_PER_SEC + ventRadiatorCooling(sim, id)) * (h.ventLen > 0 ? VENT_SEC * TICK_HZ / h.ventLen : 1) / TICK_HZ);
    } else if (shieldsDown(c)) {
      h.value = Math.max(0, h.value - passiveCooling(sim, id) / TICK_HZ);
    }
  }
}
