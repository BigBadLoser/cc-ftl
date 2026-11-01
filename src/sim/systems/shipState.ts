import { CrewC, DeadC, DownedC, HealthC, PositionC } from '../crew/components';
import { ShipC } from '../combat/components';
import { wreckShip } from '../combat/wreck';
import { hullSum } from '../combat/hull';
import { crewSubdued } from '../combat/subdued';
import { hopeless } from '../combat/hopeless';
import { AllegianceC } from '../fight/components';
import { isSubdued } from '../fight/relations';
import { surrender } from '../fight/surrender';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { SHIP_STATE_INTERVAL, WALL_WEIGHT, WRECK_BELOW } from '../tuning';
import { shipIdOf, shipGrid } from '../regions';


/**
 * Ship lifecycle, checked every few ticks. Integrity = (wall integrity x WALL_WEIGHT + module hp) over their
 * maxima. A ship is a WRECK (terminal) when integrity < WRECK_BELOW or every power source is destroyed: its
 * crew dies, its weapons and shields go dead, but the grid stays as a derelict. It is DISABLED while no crew
 * member can act or no power source runs (ion), and recovers when that clears. An enemy ship whose whole crew is subdued or dead (and
 * none of the player's stand aboard) is wrecked too: the fight ends in a derelict, see `crewSubdued`. A hostile ship whose fight is hopeless
 * (combat/hopeless.ts) surrenders first: its crew give up through the ordinary surrender path. Fled ships are left alone.
 */
export function shipStateSystem(sim: Sim): void {
  if (sim.tick % SHIP_STATE_INTERVAL !== 0) return;
  for (const id of sim.world.query(ShipC)) {
    const ship = sim.world.get(id, ShipC);
    const grid = ship && shipGrid(sim, id);
    if (!ship || !grid?.has('hp') || ship.state === 'wreck' || ship.state === 'fled' || ship.state === 'prize') continue;
    if (ship.base) continue; // a claimed asteroid base starts empty: no integrity to lose, nothing to disable
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
    // a hopeless fight (hull failing, weapons dead, crew cut off or outnumbered): its crew surrender, and the line below gives the ship up
    if (hopeless(sim, id, ship)) {
      let gaveUp = 0;
      for (const c of sim.world.query(CrewC, PositionC)) {
        const crew = sim.world.get(c, CrewC);
        if (shipIdOf(sim, sim.world.get(c, PositionC)) !== id || isSubdued(sim, c) || sim.world.get(c, AllegianceC)?.faction === 'player') continue;
        if (crew && sim.content.species[crew.species]?.fearless) continue;
        surrender(sim, c);
        gaveUp++;
      }
      if (gaveUp) sim.events.emit({ type: 'ship.surrendered', ship: id });
    }
    // an enemy ship whose whole crew is down, surrendered or dead has nothing left to fight with: it is given up as a derelict
    if (crewSubdued(sim, id, ship)) {
      wreckShip(sim, id);
      continue;
    }
    // outposts are immobile by nature and have no crew yet: never 'disabled' for that
    const disabled = !ship.outpost && (ableCrew(sim, id) === 0 || (sources > 0 && running === 0));
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
