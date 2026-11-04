import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { CombatC, ShipC, WeaponC } from './components';
import { factionsHostile } from './factions';

/** Every weapon of a ship on hold (remembering its mode), or back to the mode it had (`combat.holdAll`). */
export function holdAll(sim: Sim, ship: number, hold: boolean): void {
  for (const id of sim.world.query(WeaponC, ModuleC)) {
    const w = sim.world.get(id, WeaponC);
    if (!w || shipIdOf(sim, sim.world.get(id, ModuleC) as { x: number; y: number }) !== ship) continue;
    if (hold) {
      if (w.restore === undefined) w.restore = w.mode;
      w.mode = 'hold';
    } else if (w.restore !== undefined) {
      w.mode = w.restore;
      delete w.restore;
    }
    w.once = false;
  }
}

const playerShips = (sim: Sim): number[] => sim.world.query(ShipC, CombatC).filter((id) => sim.world.get(id, ShipC)?.faction === 'player');
const peaceful = (sim: Sim, ship: number): boolean => !factionsHostile(sim.world.get(ship, ShipC)?.faction, 'player');

/**
 * `combat.battleStations`: the player's combat view at any time. On, the player's consoles are manned with no fight on (operateJobs reads
 * `sector.stations`) and every weapon goes on hold, so nothing fires until the player says so. Off, the holds are lifted and aims at ships that are
 * not hostile are dropped (an auto weapon would otherwise fire on a neutral by itself). A real fight keeps the consoles manned either way.
 */
export function battleStations(sim: Sim, on: boolean): void {
  if (on === !!sim.sector.stations) return;
  if (on) sim.sector.stations = true;
  else delete sim.sector.stations;
  for (const ship of playerShips(sim)) {
    holdAll(sim, ship, on);
    if (on) continue;
    const combat = sim.world.get(ship, CombatC);
    if (combat?.target?.ship && peaceful(sim, combat.target.ship)) combat.target = null;
    for (const id of sim.world.query(WeaponC, ModuleC)) {
      const w = sim.world.get(id, WeaponC);
      if (w?.target?.ship && peaceful(sim, w.target.ship) && shipIdOf(sim, sim.world.get(id, ModuleC) as { x: number; y: number }) === ship) w.target = null;
    }
  }
  sim.events.emit({ type: 'combat.stations', on });
}
