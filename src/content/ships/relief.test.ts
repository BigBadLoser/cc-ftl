import { describe, expect, it } from 'vitest';
import { CrewC, ModuleC, NeedsC, newGame, operatorOf, type Sim } from '../../sim';
import { content } from '../index';
import { shipIdOf, shipIds } from '../../sim/regions';

const consoleOf = (sim: Sim, kind: string): number =>
  sim.world.query(ModuleC).find((i) => sim.content.modules[sim.world.get(i, ModuleC)!.def]?.console === kind && shipIdOf(sim, sim.world.get(i, ModuleC)) === shipIds(sim)[0]) as number;

describe('station relief in combat', () => {
  it('has idle crew take over a console its operator left to sleep', { timeout: 120000 }, () => {
    // a crewless raider: it never fires back, so nobody is repairing and the spare crew are idle
    const sim = newGame(1, { ...content, ships: { ...content.ships, 'ship.dummy': { ...content.ships['ship.raider'], crew: [] } } });
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.dummy', x: 20, y: 90 });
    const weapons = consoleOf(sim, 'weapons');
    let gunner = 0;
    for (let t = 0; t < 1500 && !gunner; t++) {
      sim.step();
      gunner = operatorOf(sim, weapons);
    }
    expect(gunner).not.toBe(0);
    sim.world.get(gunner, NeedsC)!.rest = 1; // worn out: they leave for their bunk
    let relief = 0;
    for (let t = 0; t < 1200 && !relief; t++) {
      sim.step();
      const op = operatorOf(sim, weapons);
      if (op && op !== gunner) relief = op;
    }
    expect(relief).not.toBe(0);
    expect(sim.world.get(relief, CrewC)!.role).not.toBe(sim.world.get(gunner, CrewC)!.role);
  });
});
