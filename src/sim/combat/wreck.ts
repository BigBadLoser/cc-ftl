import { killCrew } from '../crew/death';
import { CrewC, PositionC } from '../crew/components';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { WRECK_BELOW } from '../tuning';
import { CombatC, ShipC, WeaponC, type Ship } from './components';
import { shipIdOf } from '../regions';

/** Make a ship a derelict wreck (terminal): its crew dies, weapons and shields go dead, the grid stays. */
export function wreckShip(sim: Sim, shipId: number): void {
  const ship = sim.world.get(shipId, ShipC) as Ship;
  ship.state = 'wreck';
  ship.integrity = Math.min(ship.integrity, WRECK_BELOW);
  for (const id of sim.world.query(CrewC, PositionC)) {
    if (shipIdOf(sim, sim.world.get(id, PositionC)) === shipId) killCrew(sim, id);
  }
  for (const id of sim.world.query(WeaponC)) {
    const w = sim.world.get(id, WeaponC);
    if (w && shipIdOf(sim, sim.world.get(id, ModuleC)) === shipId) {
      w.charge = 0;
      w.shotsLeft = 0;
    }
  }
  for (const id of sim.world.query(ShipC, CombatC)) {
    const c = sim.world.get(id, CombatC);
    if (c && id === shipId) {
      c.shield.layers = 0;
      c.evasion = 0;
      c.pilot = 0;
      c.cruisePilot = 0;
      c.cruiseEvasion = 0;
    }
  }
  sim.events.emit({ type: 'ship.destroyed', ship: shipId });
}
