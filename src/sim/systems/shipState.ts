import { CrewC, DeadC, DownedC, HealthC, PositionC } from '../crew/components';
import { ShipC } from '../combat/components';
import { wreckShip } from '../combat/wreck';
import { hullSum } from '../combat/hull';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { SHIP_STATE_INTERVAL, WRECK_BELOW } from '../tuning';
import { shipIdOf, shipGrid } from '../regions';

/** One wall tile's weight in the integrity score, relative to one module hp (a full wall tile counts as 1.3). */
const WALL_WEIGHT = 0.005;

/**
 * Ship lifecycle, checked every few ticks. Integrity = (wall integrity x WALL_WEIGHT + module hp) over their
 * maxima. A ship is a WRECK (terminal) when integrity < WRECK_BELOW or every power source is destroyed: its
 * crew dies, its weapons and shields go dead, but the grid stays as a derelict. It is DISABLED while no crew
 * member can act or no power source runs (ion), and recovers when that clears. Fled ships are left alone.
 */
export function shipStateSystem(sim: Sim): void {
  if (sim.tick % SHIP_STATE_INTERVAL !== 0) return;
  for (const id of sim.world.query(ShipC)) {
    const ship = sim.world.get(id, ShipC);
    const grid = ship && shipGrid(sim, id);
    if (!ship || !grid?.has('hp') || ship.state === 'wreck' || ship.state === 'fled' || ship.state === 'prize') continue;
    const walls = hullSum(grid);
    ship.hullMax = Math.max(ship.hullMax, walls);
    let modHp = 0;
    let modMax = 0;
    let sources = 0;
    let alive = 0;
    let running = 0;
    for (const mid of sim.world.query(ModuleC)) {
      const m = sim.world.get(mid, ModuleC);
      const def = m && shipIdOf(sim, m) === id ? sim.content.modules[m.def] : undefined;
      if (!m || !def) continue;
      modHp += m.hp;
      modMax += def.maxHp;
      if (def.power > 0) {
        sources++;
        if (m.hp > 0) alive++;
        if (m.powered) running++;
      }
    }
    ship.integrity = (walls * WALL_WEIGHT + modHp) / Math.max(1, ship.hullMax * WALL_WEIGHT + modMax);
    if (ship.integrity < WRECK_BELOW || (sources > 0 && alive === 0)) {
      wreckShip(sim, id);
      continue;
    }
    const disabled = ableCrew(sim, id) === 0 || (sources > 0 && running === 0);
    if (disabled && ship.state === 'active') {
      ship.state = 'disabled';
      sim.events.emit({ type: 'ship.disabled', ship: id });
    } else if (!disabled && ship.state === 'disabled') {
      ship.state = 'active';
      sim.events.emit({ type: 'ship.recovered', ship: id });
    }
  }
}

function ableCrew(sim: Sim, shipId: number): number {
  let n = 0;
  for (const id of sim.world.query(CrewC, HealthC, PositionC)) {
    if (shipIdOf(sim, sim.world.get(id, PositionC)) === shipId && !sim.world.has(id, DeadC) && !sim.world.has(id, DownedC)) n++;
  }
  return n;
}
