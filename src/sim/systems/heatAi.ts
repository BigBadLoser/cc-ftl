import { CombatC, ProjectileC, ShipC, WeaponC } from '../combat/components';
import { factionsHostile, isAiFaction } from '../combat/factions';
import { overchargeError, ventError } from '../combat/heat';
import { AI_OVERCHARGE_BELOW, AUTO_SHOT_SOON_CHARGE, AUTO_VENT_AT, AUTO_VENT_FORCE_AT, HEAT_MAX } from '../combat/heatTuning';
import { shipById } from '../combat/ships';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';

/**
 * Enemy heat management by command. Enemy ships play by the player's rules: they vent when their heat is high and no shot is about to land
 * on them (or at once when nearly overheated: a lockout is worse), and overcharge their weapons while their heat is low. The player's ship
 * does none of this by itself; its heat is the player's to manage. The AI's auto-fire half (holding a volley that would overheat) is in the
 * firing system. Commands apply next tick; this system only reads.
 */
export function heatAiSystem(sim: Sim): void {
  if (!sim.sector.inCombat) return;
  for (const id of sim.world.query(ShipC, CombatC)) {
    const ship = sim.world.get(id, ShipC);
    const c = sim.world.get(id, CombatC);
    if (!ship || !c || ship.state !== 'active') continue;
    if (!isAiFaction(ship.faction)) continue; // the player's heat is the player's to manage
    if (ventError(c) === null && c.heat.value >= HEAT_MAX * AUTO_VENT_AT && (c.heat.value >= HEAT_MAX * AUTO_VENT_FORCE_AT || !shotAboutToLand(sim, id))) {
      sim.enqueue({ type: 'combat.vent', ship: id });
      continue;
    }
    if (c.target && c.heat.value < HEAT_MAX * AI_OVERCHARGE_BELOW && overchargeError(c, 'weapons') === null) {
      sim.enqueue({ type: 'combat.overcharge', ship: id, system: 'weapons' });
    }
  }
}

/** A shot is in the air at this ship, or a hostile weapon aimed at it is nearly charged. */
export function shotAboutToLand(sim: Sim, shipId: number): boolean {
  for (const pid of sim.world.query(ProjectileC)) {
    if (sim.world.get(pid, ProjectileC)?.target.ship === shipId) return true;
  }
  const me = shipById(sim, shipId);
  if (!me) return false;
  for (const wid of sim.world.query(WeaponC, ModuleC)) {
    const w = sim.world.get(wid, WeaponC);
    const m = sim.world.get(wid, ModuleC);
    if (!w || !m || w.charge < AUTO_SHOT_SOON_CHARGE) continue;
    const owner = shipIdOf(sim, m);
    const from = owner !== shipId && shipById(sim, owner);
    if (!from || from.state !== 'active' || !factionsHostile(from.faction, me.faction) || !m.powered || m.hp <= 0) continue;
    const t = w.target ?? sim.world.get(owner, CombatC)?.target;
    if (t?.ship === shipId) return true;
  }
  return false;
}
