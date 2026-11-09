import { describe, expect, it } from 'vitest';
import { CrewC, ShipC, StorageC, newGame, type Sim } from '../sim';
import { NeedsC } from '../sim/crew/components';
import { storagesOn } from '../sim/combat/ammo';
import { StationCrewC } from '../sim/stations/components';
import { FOOD_PER_CREW } from '../sim/stations/food';
import { content } from './index';

const spawn = (kind: string, size: 'outpost' | 'station' | 'hub', seed: number): { sim: Sim; st: number } => {
  const sim = newGame(3, content);
  sim.enqueue({ type: 'debug.spawnStation', kind, size, seed });
  sim.step();
  return { sim, st: sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.immobile)! };
};
const foodOf = (sim: Sim, st: number): number => {
  let n = 0;
  for (const id of storagesOn(sim, st)) for (const s of sim.world.get(id, StorageC)?.stacks ?? []) if (sim.content.items[s.item]?.food) n += s.count;
  return n;
};
const crewOf = (sim: Sim, st: number): number[] => sim.world.query(StationCrewC, CrewC).filter((c) => sim.world.get(c, StationCrewC)?.station === st);
const hungerOf = (sim: Sim, c: number): number => sim.world.get(c, NeedsC)?.hunger ?? 100;

describe('station food (#402)', () => {
  it.each(['station.military', 'station.trading', 'station.mining', 'station.research', 'station.pirate'])('%s starts stocked to its crew', (kind) => {
    const { sim, st } = spawn(kind, 'station', 5);
    expect(crewOf(sim, st).length).toBeGreaterThan(0);
    expect(foodOf(sim, st)).toBeGreaterThanOrEqual(crewOf(sim, st).length * FOOD_PER_CREW);
  });

  it('a big military hub stays fed over a long run, and the supply runs refill an emptied larder', () => {
    const { sim, st } = spawn('station.military', 'hub', 4);
    const crew = crewOf(sim, st);
    expect(crew.length).toBeGreaterThan(20);
    const lows: number[] = [];
    for (let t = 0; t < 30000; t++) {
      sim.step();
      sim.events.drain();
      if (t === 10000) for (const id of storagesOn(sim, st)) for (const s of sim.world.get(id, StorageC)!.stacks) if (sim.content.items[s.item]?.food) s.count = 0;
      if (t % 600 === 0) lows.push(Math.min(...crewOf(sim, st).map((c) => hungerOf(sim, c))));
    }
    expect(Math.min(...lows), `lowest hunger sampled: ${lows.join(',')}`).toBeGreaterThan(0);
    expect(foodOf(sim, st)).toBeGreaterThan(0);
  }, 600000);
});
