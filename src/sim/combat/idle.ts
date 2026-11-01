import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { shipIdOf } from '../regions';
import { ammoCount } from './ammo';
import { CombatC, IonC, WeaponC, type Target } from './components';
import { operatorOf } from './operators';
import { shipById } from './ships';
import { targetableShip, targetableVehicle, weaponAntiVehicle } from './targets';

/** Does the target still name something to shoot at (a live ship, or a shuttle in the open)? Read-only. */
function live(sim: Sim, t: Target | null | undefined): boolean {
  if (!t) return false;
  if (t.vehicle) return targetableVehicle(sim, t.vehicle);
  return targetableShip(sim, t.ship) && shipById(sim, t.ship)?.state !== 'wreck';
}

/**
 * Why a ship's weapons are not firing right now, as a short line for the combat panel, or null when they fire or charge as they should.
 * Checked in the order a player would fix them: ship, weapons, console, target, ammo, hold. Reads the sim only.
 */
export function weaponsIdleReason(sim: Sim, shipId: number): string | null {
  const ship = shipById(sim, shipId);
  const combat = sim.world.get(shipId, CombatC);
  if (!ship || !combat) return null;
  const weapons = sim.world.query(WeaponC, ModuleC).filter((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === shipId);
  if (weapons.length === 0) return null;
  if (ship.state !== 'active') return 'Ship disabled';
  const hp = (id: number): number => sim.world.get(id, ModuleC)?.hp ?? 0;
  const usable = weapons.filter((id) => hp(id) > 0 && sim.world.get(id, ModuleC)?.powered && !sim.world.has(id, IonC));
  if (usable.length === 0) {
    if (weapons.every((id) => hp(id) <= 0)) return 'Weapons destroyed';
    return weapons.some((id) => sim.world.has(id, IonC)) ? 'Weapons ion-disabled' : 'No power';
  }
  const consoles = sim.world.query(ModuleC).filter((id) => {
    const m = sim.world.get(id, ModuleC);
    return !!m && sim.content.modules[m.def]?.console === 'weapons' && shipIdOf(sim, m) === shipId;
  });
  if (consoles.length === 0) return 'No weapons console';
  const working = consoles.filter((id) => hp(id) > 0 && sim.world.get(id, ModuleC)?.powered && !sim.world.has(id, IonC));
  if (working.length === 0) return 'Weapons console offline';
  if (!working.some((id) => operatorOf(sim, id))) return 'Weapons console unmanned';
  const aimed = usable.filter((id) => {
    const own = sim.world.get(id, WeaponC)?.target;
    return live(sim, own && (weaponAntiVehicle(sim, id) || !own.vehicle) ? own : combat.target) || (weaponAntiVehicle(sim, id) && live(sim, combat.vehicleTarget ? { ship: 0, moduleId: 0, vehicle: combat.vehicleTarget } : null));
  });
  if (aimed.length === 0) return 'No targets';
  const armed = aimed.filter((id) => {
    const ammo = sim.content.weapons?.[sim.content.modules[sim.world.get(id, ModuleC)?.def ?? '']?.weapon ?? '']?.ammo;
    return !ammo || ammoCount(sim, shipId, ammo) > 0;
  });
  if (armed.length === 0) return 'No ammo';
  if (combat.hold || armed.every((id) => sim.world.get(id, WeaponC)?.mode === 'hold' && !sim.world.get(id, WeaponC)?.once)) return 'Holding fire';
  return null;
}
