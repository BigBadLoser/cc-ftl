import { killCrew } from '../crew/death';
import { CrewC, PositionC } from '../crew/components';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { WRECK_BELOW } from '../tuning';
import { CombatC, ShipC, WeaponC, type Ship } from './components';
import { shipIdOf } from '../regions';

/** Was the player shooting at the ship: a player ship's ship-wide target, or a weapon of one aimed at it? */
function playerTargets(sim: Sim, shipId: number): boolean {
  const mine = (id: number): boolean => sim.world.get(id, ShipC)?.faction === 'player';
  for (const id of sim.world.query(ShipC, CombatC)) if (mine(id) && sim.world.get(id, CombatC)?.target?.ship === shipId) return true;
  for (const id of sim.world.query(WeaponC)) {
    const w = sim.world.get(id, WeaponC);
    if (w && (w.target?.ship === shipId || w.volleyTarget?.ship === shipId) && mine(shipIdOf(sim, sim.world.get(id, ModuleC)))) return true;
  }
  return false;
}

/** Make a ship a derelict wreck (terminal): its crew dies, weapons and shields go dead, the grid stays. A ship the player was shooting at is marked as theirs. */
export function wreckShip(sim: Sim, shipId: number): void {
  const ship = sim.world.get(shipId, ShipC) as Ship;
  if (ship.faction !== 'player' && playerTargets(sim, shipId)) ship.killedBy = 'player';
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
