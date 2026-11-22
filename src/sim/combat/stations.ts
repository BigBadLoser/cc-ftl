import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { CombatC, ShipC, WeaponC } from './components';
import { factionsHostile } from './factions';
import { isPlayers, PLAYER } from '../side';

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

/** Drop a ship's aims (ship-wide, each weapon's own and its committed volley) at ships `drop` names: the one place aims are cleared by whom they point at. */
export function dropAims(sim: Sim, ship: number, drop: (target: number) => boolean): void {
  const combat = sim.world.get(ship, CombatC);
  if (combat?.target?.ship && drop(combat.target.ship)) combat.target = null;
  for (const id of sim.world.query(WeaponC, ModuleC)) {
    const w = sim.world.get(id, WeaponC);
    if (!w || shipIdOf(sim, sim.world.get(id, ModuleC) as { x: number; y: number }) !== ship) continue;
    if (w.target?.ship && drop(w.target.ship)) w.target = null;
    if (w.commit?.target.ship && drop(w.commit.target.ship)) w.commit = null;
  }
}

const playerShips = (sim: Sim): number[] => sim.world.query(ShipC, CombatC).filter((id) => isPlayers(sim, id));
const peaceful = (sim: Sim, ship: number): boolean => !factionsHostile(sim.world.get(ship, ShipC)?.faction, PLAYER);

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
    if (!on) dropAims(sim, ship, (t) => peaceful(sim, t));
  }
  sim.events.emit({ type: 'combat.stations', on });
}
