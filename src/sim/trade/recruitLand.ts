import { CrewC, DeadC, DraftedC, PositionC } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { AllegianceC } from '../fight/components';
import { isTileWalkable } from '../modules/walk';
import { shipGrid, shipIdOf } from '../regions';
import { ShipC } from '../combat/components';
import { playerShip } from './player';
import type { Sim } from '../sim';
import { ForHireC, StationCrewC } from '../stations/components';
import { bumpStat } from '../story/goals';
import { logRecruit } from '../galaxy/recruit';
import { AboardC, EmbarkOrderC, VehicleC, type Vehicle } from '../vehicles/components';
import { bayAccessTile, boardingTile } from '../vehicles/geometry';
import { unboardCrew } from '../vehicles/lifecycle';
import { ModuleC } from '../modules/components';
import type { Deal } from './types';

/**
 * The people side of a hiring run (a Deal with `crew`; the flow itself is in dealFlow.ts). At the station dock the recruits are sent
 * to the shuttle; once all are aboard it flies home; docked there they step out, become the player's crew and the escrow is paid.
 */

const alive = (sim: Sim, c: number): boolean => sim.world.has(c, CrewC) && !sim.world.has(c, DeadC) && !isIncapacitated(sim, c);

/** A recruit that is no longer there to be fetched (dead, downed or removed), or undefined. */
export function lostRecruit(sim: Sim, d: Deal): number | undefined {
  return d.crew?.find((c) => !alive(sim, c) || (!sim.world.has(c, PositionC) && !sim.world.has(c, AboardC)));
}

/** Send the recruits aboard the docked shuttle (repeating the order while it is not obeyed); true once every one is aboard. */
export function boardRecruits(sim: Sim, d: Deal, repeat: boolean): boolean {
  let all = true;
  for (const c of d.crew ?? []) {
    if (sim.world.get(c, AboardC)?.vehicle === d.vehicle) continue;
    all = false;
    if (repeat && !sim.world.has(c, EmbarkOrderC)) sim.enqueue({ type: 'vehicle.embark', crew: c, vehicle: d.vehicle });
  }
  return all;
}

/** Last resort for a forced landing: the walkable tile of the player's ship nearest its centre, or null when it has none. */
function anyFloorTile(sim: Sim): { shipId: number; x: number; y: number } | null {
  const id = playerShip(sim);
  const ship = id ? sim.world.get(id, ShipC) : undefined;
  const grid = id ? shipGrid(sim, id) : undefined;
  if (!ship || !grid) return null;
  const cx = ship.x + ship.width / 2;
  const cy = ship.y + ship.height / 2;
  let best: { x: number; y: number; d: number } | null = null;
  for (let y = ship.y; y < ship.y + ship.height; y++) {
    for (let x = ship.x; x < ship.x + ship.width; x++) {
      if (!isTileWalkable(sim, grid, x, y)) continue;
      const d = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
      if (!best || d < best.d) best = { x, y, d };
    }
  }
  return best && { shipId: id, x: best.x, y: best.y };
}

/** Whether the shuttle is docked at an airlock of the given ship. */
const dockedAt = (sim: Sim, v: Vehicle, ship: number): boolean => v.state === 'docked' && shipIdOf(sim, sim.world.get(v.dock, ModuleC)) === ship;

/**
 * Docked at home: the recruits step out and become the player's crew (allegiance, off the station roll, out of the for-hire list); their
 * keys go into the log so the candidate does not come back. True when everyone is out (or gone). `force` lands them even where the
 * shuttle is not docked, so nobody is left aboard without a tile.
 */
export function landRecruits(sim: Sim, d: Deal, force = false): boolean {
  const v = sim.world.get(d.vehicle, VehicleC);
  // `force` (a run given up on, recruits already aboard): they step out at the shuttle's home bay even if it is not docked or stowed.
  const at = v && (boardingTile(sim, d.vehicle) ?? (force ? bayAccessTile(sim, v) ?? anyFloorTile(sim) : null));
  const grid = at && shipGrid(sim, at.shipId);
  const ready = !!at && !!grid && (force || isTileWalkable(sim, grid, at.x, at.y));
  let done = true;
  for (const c of d.crew ?? []) {
    if (sim.world.get(c, AboardC)?.vehicle === d.vehicle) {
      if (!ready || !at) { done = false; continue; }
      unboardCrew(sim, c, d.vehicle, at);
    }
    const hire = sim.world.get(c, ForHireC);
    if (!hire || !sim.world.has(c, CrewC)) continue;
    const crew = sim.world.get(c, CrewC);
    sim.world.remove(c, ForHireC);
    sim.world.remove(c, StationCrewC);
    sim.world.remove(c, DraftedC);
    const a = sim.world.get(c, AllegianceC);
    if (a) a.faction = 'player';
    logRecruit(sim, hire.key);
    sim.galaxy.rev++;
    bumpStat(sim, 'hired');
    sim.events.emit({ type: 'crew.hired', crew: c, role: crew?.role ?? '', cost: hire.cost });
  }
  return done;
}

/**
 * A hiring run is called off: recruits still walking to the shuttle stop; those already aboard step out at the station dock (if the
 * shuttle is there) and go back to station life. Anyone aboard a shuttle already flying stays with it (it goes home regardless).
 */
export function releaseRecruits(sim: Sim, d: Deal): void {
  const v = sim.world.get(d.vehicle, VehicleC);
  const at = v && dockedAt(sim, v, d.ship) ? boardingTile(sim, d.vehicle) : null;
  for (const c of d.crew ?? []) {
    sim.world.remove(c, EmbarkOrderC);
    if (sim.world.get(c, AboardC)?.vehicle === d.vehicle) {
      if (at) unboardCrew(sim, c, d.vehicle, at);
      else continue;
    }
    if (sim.world.has(c, ForHireC) && sim.world.has(c, PositionC)) {
      sim.world.remove(c, DraftedC);
      const crew = sim.world.get(c, CrewC);
      if (crew) crew.activity = 'idle';
    }
  }
}

/** Whether any recruit of a hiring run is aboard the run's shuttle (boarding is the exchange: the hire is theirs from then on). */
export const recruitsAboard = (sim: Sim, d: Deal): boolean => !!d.crew?.some((c) => sim.world.get(c, AboardC)?.vehicle === d.vehicle);
