// Narrow imports on purpose: a test that imports these must not pull the whole sim (and so every system) into its import graph.
import { stampShip } from '../../src/sim/combat/ships';
import { CrewC, PositionC } from '../../src/sim/crew/components';
import type { ShipTemplate } from '../../src/sim/registry';
import { shipIdOf, shipIds } from '../../src/sim/regions';
import type { Sim } from '../../src/sim/sim';
import type { SimEvent } from '../../src/sim/events';

export { run, runLog, runSim, step, logLine, type RunOpts, type RunResult } from './run';

/** The ship with ordinal `n` (1 = the first ship created, usually the player's; 2 = the next). */
export const nth = (sim: Sim, n: number): number => shipIds(sim)[n - 1] as number;

/** The events of one type, typed. */
export const eventsOf = <T extends SimEvent['type']>(events: SimEvent[], type: T): Extract<SimEvent, { type: T }>[] =>
  events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);

/** The crew standing on the ship with ordinal `n` (see `nth`). */
export const crewOn = (sim: Sim, n: number): number[] => sim.world.query(CrewC).filter((i) => shipIdOf(sim, sim.world.get(i, PositionC)) === nth(sim, n));

/** A fixture ship: the template stamped at the sector origin as an inert ship (a prize is skipped by every ship system). */
export function fixtureShip(sim: Sim, template: ShipTemplate): number {
  return stampShip(sim, template, { faction: 'player', state: 'prize', x: 0, y: 0 });
}
