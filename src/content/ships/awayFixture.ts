/** Shared setup for the away site tests (#286): work on the salvage fixture's wreck, and a party landed on it. */
import { CrewC, DeadC, DraftedC, JobC, PositionC, ShipC, type ContentRegistry, type Sim, type SimEvent } from '../../sim';
import { awayLeaks } from '../../sim/away/owned';
import { content } from '../index';
import { shipIdOf } from '../../sim/regions';
import { shuttleOf } from './ferryFixture';
import { play as playRaw, setup } from './salvageEvaFixture';

/** Deconstruct jobs on `n` of the wreck's top hull walls: construction work on the site, reachable from the hull. */
export function siteWork(sim: Sim, wreck: number, n = 1): number[] {
  const s = sim.world.get(wreck, ShipC)!;
  return Array.from({ length: n }, (_, i) => {
    const id = sim.world.createEntity();
    sim.world.add(id, JobC, { category: 'construction', kind: 'deconstruct', x: s.x + 2 + i, y: s.y + 1, struct: 0, work: 400, progress: 0, reservedBy: 0 });
    return id;
  });
}

export const crewOn = (sim: Sim, ship: number): number[] =>
  [...sim.world.query(CrewC, PositionC)].filter((c) => !sim.world.has(c, DeadC) && shipIdOf(sim, sim.world.get(c, PositionC)!) === ship).sort((a, b) => a - b);

/**
 * The away tests' `play`: each tick, the ownership audit (away/owned.ts). A piece of away-owned state found with its owner gone on two
 * ticks in a row outlived the sweep: a leak, and the test fails.
 */
export function play(sim: Sim, n: number, until?: (all: SimEvent[]) => boolean): SimEvent[] {
  const all: SimEvent[] = [];
  let before = new Set(awayLeaks(sim));
  for (let i = 0; i < n; i++) {
    all.push(...playRaw(sim, 1));
    const now = awayLeaks(sim);
    const stuck = now.filter((l) => before.has(l));
    if (stuck.length > 0) throw new Error(`away-owned state outlived its owner at tick ${sim.tick}: ${stuck.join(', ')}`);
    before = new Set(now);
    if (until?.(all)) break;
  }
  return all;
}

/** Open a site on the fixture's wreck with work on it, and play until the party has landed and been handed to the crew AI. */
export function landed(n = 3, c: ContentRegistry = content): { sim: Sim; home: number; wreck: number; shuttle: number; party: number[] } {
  const { sim, home, wreck } = setup(3, c);
  siteWork(sim, wreck, n);
  const shuttle = shuttleOf(sim);
  sim.enqueue({ type: 'away.open', ship: wreck });
  play(sim, 20 * 200, () => crewOn(sim, wreck).length > 0 && crewOn(sim, wreck).every((c) => !sim.world.has(c, DraftedC)));
  return { sim, home, wreck, shuttle, party: crewOn(sim, wreck) };
}

