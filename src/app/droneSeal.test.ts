import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { homeShip, newGame, Struct, type Sim, type SimEvent } from '../sim';
import { ammoCount, takeStock } from '../sim/combat/ammo';
import { breachesOf } from '../sim/crew/breach';
import { DroneC } from '../sim/drones/components';
import { shipGrid } from '../sim/regions';
import { droneScenarioCommands } from './droneScenario';

/** The starter with two bays, two repair drones carrying metal, and a hole in the hull. */
function breached(): { sim: Sim; events: SimEvent[]; step: (secs: number) => void } {
  const sim = newGame(7, content);
  const events: SimEvent[] = [];
  const step = (secs: number): void => {
    for (let i = 0; i < secs * 20; i++) {
      sim.step();
      events.push(...sim.events.drain());
    }
  };
  step(1);
  for (const c of droneScenarioCommands(sim, false, true)) sim.enqueue(c);
  step(0.05);
  return { sim, events, step };
}

const holes = (sim: Sim) => breachesOf(shipGrid(sim, homeShip(sim))!);
const drones = (sim: Sim) => sim.world.query(DroneC).map((id) => sim.world.get(id, DroneC)!);

describe('outside breach repair (#318 slice 2b)', () => {
  it('a docked repair drone tops its load up from the ship storage', () => {
    const { sim, step } = breached();
    const before = ammoCount(sim, homeShip(sim), 'item.metal'); // the 8 given are in
    step(1.5);
    const loads = drones(sim).map((d) => d.load ?? 0);
    expect(loads.length).toBe(2);
    expect(loads.every((l) => l === 4)).toBe(true);
    expect(ammoCount(sim, homeShip(sim), 'item.metal')).toBe(before - 8); // 4 into each drone
  });

  it('a repair drone flies out through the hatch, seals the hole from outside for the wall cost, and the hole is closed like a crew patch', () => {
    const { sim, events, step } = breached();
    expect(holes(sim).length).toBe(1);
    const hole = holes(sim)[0]!;
    step(1.5);
    const stock = ammoCount(sim, homeShip(sim), 'item.metal');
    step(30);
    expect(events.some((e) => e.type === 'drone.launchedSpace')).toBe(true);
    expect(events.some((e) => e.type === 'drone.sealed' && e.x === hole.x && e.y === hole.y)).toBe(true);
    expect(holes(sim).length).toBe(0);
    expect(shipGrid(sim, homeShip(sim))!.get('struct', hole.x, hole.y)).toBe(Struct.Wall);
    const cost = content.structCosts.wall.reduce((n, q) => n + q.count, 0);
    // It paid the wall's cost from its load, and once home it was topped up again from the stores: the ship is down exactly that metal.
    expect(ammoCount(sim, homeShip(sim), 'item.metal')).toBe(stock - cost);
    expect(drones(sim).every((d) => d.state === 'docked' && d.load === 4)).toBe(true);
  });

  it('a drone without enough load does not take the breach (it can still repair modules)', () => {
    const { sim, step } = breached();
    step(1.5);
    takeStock(sim, homeShip(sim), 'item.metal', 1000); // nothing left to refill from
    for (const id of sim.world.query(DroneC)) sim.world.get(id, DroneC)!.load = 1;
    step(20);
    expect(holes(sim).length).toBe(1);
    expect(drones(sim).every((d) => d.state === 'docked' && !d.space)).toBe(true);
  });
});
