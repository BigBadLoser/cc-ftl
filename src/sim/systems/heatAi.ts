import { CombatC, ProjectileC, ShipC, WeaponC } from '../combat/components';
import { factionsHostile, isAiFaction } from '../combat/factions';
import { overchargeError, ventError } from '../combat/heat';
import { AI_OVERCHARGE_BELOW, AUTO_SHOT_SOON_CHARGE, AUTO_VENT_AT, AUTO_VENT_FORCE_AT, HEAT_MAX } from '../combat/heatTuning';
import { shipById } from '../combat/ships';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';

/**
 * Heat management by command. The enemy AI always plays by the player's rules: it vents when its heat is high and no shot is about to land
 * on it (or at once when it is nearly overheated: a lockout is worse), and overcharges its weapons while its heat is low. The player's ship does
 * the same (vent and weapons overcharge) on its own while `Heat.auto` is on (the default), so a ship given no orders still avoids overheating. Auto-fire's own half
 * (holding a volley that would overheat) is in the firing system. Commands apply next tick; this system only reads.
 */
export function heatAiSystem(sim: Sim): void {
  if (!sim.sector.inCombat) return;
  for (const id of sim.world.query(ShipC, CombatC)) {
    const ship = sim.world.get(id, ShipC);
    const c = sim.world.get(id, CombatC);
    if (!ship || !c || ship.state !== 'active') continue;
    const ai = isAiFaction(ship.faction);
    if (!ai && !(ship.faction === 'player' && c.heat.auto)) continue;
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
function shotAboutToLand(sim: Sim, shipId: number): boolean {
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
