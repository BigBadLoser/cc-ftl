import { CombatC, IonC, ProjectileC, ShipC, WeaponC, type Combat } from '../combat/components';
import { factionsHostile, isAiFaction } from '../combat/factions';
import { ammoCount } from '../combat/ammo';
import { heatCeilingBlocks, overchargeError, ventError } from '../combat/heat';
import { AI_OVERCHARGE_BELOW, AUTO_SHOT_SOON_CHARGE, AUTO_VENT_AT, AUTO_VENT_FORCE_AT, HEAT_MAX } from '../combat/heatTuning';
import { shipById } from '../combat/ships';
import { ModuleC } from '../modules/components';
import { isDeployed } from '../modules/deploy';
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
    if (ventError(c) === null && c.heat.value >= HEAT_MAX * AUTO_VENT_AT && (c.heat.value >= HEAT_MAX * AUTO_VENT_FORCE_AT || !shotAboutToLand(sim, id) || ceilingBlocksAll(sim, id, c))) {
      sim.enqueue({ type: 'combat.vent', ship: id });
      continue;
    }
    if (c.target && c.heat.value < HEAT_MAX * AI_OVERCHARGE_BELOW && overchargeError(c, 'weapons') === null) {
      sim.enqueue({ type: 'combat.overcharge', ship: id, system: 'weapons' });
    }
  }
}

/**
 * The ship has weapons it could fire but the heat ceiling (the firing system's own rule) holds every one of them: with the shields up heat does not fall
 * by itself, so without a vent it would never fire again. False with no usable weapon (a vent would not help).
 */
function ceilingBlocksAll(sim: Sim, shipId: number, c: Combat): boolean {
  let usable = 0;
  for (const wid of sim.world.query(WeaponC, ModuleC)) {
    const m = sim.world.get(wid, ModuleC);
    const def = m && sim.content.weapons?.[sim.content.modules[m.def]?.weapon ?? ''];
    if (!m || !def || shipIdOf(sim, m) !== shipId || !m.powered || m.hp <= 0 || sim.world.has(wid, IonC) || !isDeployed(sim, wid)) continue;
    if (def.ammo && ammoCount(sim, shipId, def.ammo) <= 0) continue;
    if (!heatCeilingBlocks(c, def.heat)) return false;
    usable++;
  }
  return usable > 0;
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
