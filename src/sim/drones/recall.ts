import { CombatC, type DepartHold } from '../combat/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { DRONE_LAND_GAP_SEC, DRONE_LIFT_SEC, DRONE_QUEUE_RADIUS, DRONE_RECALL_WAIT_SEC } from '../tuning';
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

/** The place of a recalled drone's queue round a hatch: spread round it by id so the waiting drones do not sit on one another. */
export function queuePlace(hatch: { x: number; y: number }, id: number): { x: number; y: number } {
  const a = (id % 6) * (Math.PI / 3);
  return { x: hatch.x + Math.cos(a) * DRONE_QUEUE_RADIUS, y: hatch.y + Math.sin(a) * DRONE_QUEUE_RADIUS };
}

/**
 * Staggered return: a recalled drone starts in only once no other drone of its ship is on its way to a hatch (cleared) or has been coming
 * down for less than DRONE_LAND_GAP_SEC, so they dock one after another and the ship is not unguarded in a block. The wait for them is
 * `DRONE_RECALL_WAIT_SEC`: the gap stays under DRONE_LIFT_SEC, so a landing never holds up the next one for longer than it takes.
 */
export function landingBusy(sim: Sim, id: number, mine: Drone): boolean {
  const gap = Math.min(DRONE_LAND_GAP_SEC, DRONE_LIFT_SEC) / DRONE_LIFT_SEC;
  for (const other of sim.world.query(DroneC)) {
    const o = sim.world.get(other, DroneC);
    if (other === id || !o || o.ship !== mine.ship || !o.space) continue;
    if ((o.state === 'home' && o.clear) || (o.state === 'land' && o.lift < gap)) return true;
  }
  return false;
}
