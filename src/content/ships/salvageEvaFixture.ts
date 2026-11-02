/** Shared setup for the salvage team tests: a new game with a small sealed derelict beside the home ship, and small run helpers. */
import { ItemStackC, ShipC, StorageC, VehicleC, homeShip, newGame, stampShip, type Sim, type SimEvent } from '../../sim';
import { shipIdAt } from '../../sim/regions';
import { content } from '../index';
import { storages } from './ferryFixture';

type Ev = SimEvent['type'];
export const of = <T extends Ev>(all: SimEvent[], type: T): Extract<SimEvent, { type: T }>[] => all.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);

/** Step up to `n` ticks, until `until` says stop; returns every event seen. */
export function play(sim: Sim, n: number, until?: (all: SimEvent[]) => boolean): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    all.push(...sim.events.drain());
    if (until?.(all)) break;
  }
  return all;
}

/** A small sealed derelict (8x5 hull in a ring of open space, one console inside, no air) 16 tiles east of the home ship. */
export function setup(seed = 3): { sim: Sim; home: number; wreck: number } {
  const sim = newGame(seed, content);
  const home = homeShip(sim);
  const h = sim.world.get(home, ShipC)!;
  const rows = ['..........', '.########.', '.#______#.', '.#______#.', '.#______#.', '.########.', '..........'];
  const wreck = stampShip(sim, { name: 'Hulk', rows, modules: [{ def: 'module.console', x: 4, y: 3, rot: 0 }] }, { faction: 'neutral', state: 'wreck', x: h.x + h.width + 16, y: h.y + 2 });
  play(sim, 5);
  return { sim, home, wreck };
}

const isScrap = (item: string): boolean => item.startsWith('item.scrap_');

/** Scrap units on the home ship: in its storage, loose on its floor, and in the hold of a shuttle parked in its bay. */
export function scrapHome(sim: Sim, home: number): number {
  let n = 0;
  for (const id of storages(sim, home)) for (const st of sim.world.get(id, StorageC)!.stacks) if (isScrap(st.item)) n += st.count;
  for (const id of sim.world.query(ItemStackC)) {
    const st = sim.world.get(id, ItemStackC)!;
    if (isScrap(st.item) && shipIdAt(sim, st.x, st.y) === home) n += st.count;
  }
  for (const id of sim.world.query(VehicleC)) {
    const v = sim.world.get(id, VehicleC)!;
    if (v.state === 'stowed') for (const q of v.cargo) if (isScrap(q.item)) n += q.count;
  }
  return n;
}
