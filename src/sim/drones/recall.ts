import { CombatC, type DepartHold } from '../combat/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { DRONE_RECALL_WAIT_SEC } from '../tuning';
import { DroneC, type Drone } from './components';

/**
 * Drones and departures (DESIGN.md "Drones": jumping and leaving). Charging a jump, or a departure being held, recalls every drone of the
 * ship: none launches and those out fly home. A departure (a jump, a flee, leaving a scene) with drones still outside waits for them up to
 * DRONE_RECALL_WAIT_SEC (`holdDeparture`); whatever is still outside when the ship goes is lost (`loseStrandedDrones`). Drones inside the
 * ship are aboard and lift with it.
 */

/** True while the drone is aboard its ship: docked, or flying inside it (not in space, not going through the hatch). */
export const droneAboard = (d: Drone): boolean => d.state === 'docked' || (!d.space && d.state !== 'launch' && d.state !== 'land');

/** The ship's drones outside it (in space or in its hatch), ascending ids. */
export function dronesOutside(sim: Sim, ship: number): number[] {
  return sim.world.query(DroneC).filter((id) => {
    const d = sim.world.get(id, DroneC);
    return !!d && d.ship === ship && !droneAboard(d);
  });
}

/** True while the ship's drones are called home: a jump is being charged, or a departure is waiting for them. */
export function recalled(sim: Sim, ship: number): boolean {
  const c = sim.world.get(ship, CombatC);
  return !!c && (!!c.ftlOrder?.jump || !!c.departHold);
}

/**
 * Called by a departure just before the ship goes. With drones outside and no hold yet it holds the departure (stored on the ship, retried
 * every tick by the helm, ftl/order.ts `settleDeparture`) and returns true: the caller stops. A held departure goes ahead (false) once they
 * are all aboard or the wait is over; the hold is then cleared.
 */
export function holdDeparture(sim: Sim, ship: number, hold: Omit<DepartHold, 'since'>): boolean {
  const c = sim.world.get(ship, CombatC);
  if (!c) return false;
  const outside = dronesOutside(sim, ship).length;
  if (c.departHold) {
    if (outside > 0 && sim.tick - c.departHold.since < DRONE_RECALL_WAIT_SEC * TICK_HZ) return true;
    c.departHold = null;
    return false;
  }
  if (outside === 0) return false;
  c.departHold = { ...hold, since: sim.tick };
  sim.events.emit({ type: 'drone.recall', ship, drones: outside });
  return true;
}

/** True once a held departure may go: no drone left outside, or the wait is over. */
export function departureDue(sim: Sim, ship: number): boolean {
  const hold = sim.world.get(ship, CombatC)?.departHold;
  return !!hold && (dronesOutside(sim, ship).length === 0 || sim.tick - hold.since >= DRONE_RECALL_WAIT_SEC * TICK_HZ);
}

/** The ship leaves: its drones still outside are left behind and lost. */
export function loseStrandedDrones(sim: Sim, ship: number): void {
  for (const id of dronesOutside(sim, ship)) {
    const d = sim.world.get(id, DroneC) as Drone;
    sim.events.emit({ type: 'drone.lost', drone: id, ship, def: d.def });
    sim.world.destroyEntity(id);
  }
}
