import { describe, expect, it } from 'vitest';
import { stampShip } from '../combat/ships';
import { PlotC } from '../farm/components';
import type { ContentRegistry, ModuleDef } from '../registry';
import { Sim } from '../sim';
import { ModuleC } from './components';
import { spawnModule } from './spawn';

const mod = (o: Partial<ModuleDef>): ModuleDef => ({ name: 'm', asset: 'm', footprint: [1, 1], solid: false, power: 0, flammability: 0.1, maxHp: 100, buildWork: 20, ...o });
const content: ContentRegistry = {
  ships: {}, roles: {}, species: {}, crewNames: [], items: {}, recipes: {}, structCosts: {},
  modules: {
    reactor: mod({ power: 2 }),
    bed: mod({ power: -2, powerPriority: 1, plot: { scale: 1 }, drawsWhen: 'planted' }),
    lamp: mod({ power: -2, powerPriority: 9 }),
  },
};

describe('a module whose draw depends on its state (ModuleDef.drawsWhen)', () => {
  function setup(): { sim: Sim; bed: number; lamp: number } {
    const sim = new Sim(1, content);
    stampShip(sim, { name: 't', rows: ['#####', '#___#', '#####'] }, { faction: 'player', state: 'prize', x: 0, y: 0 });
    spawnModule(sim, 'reactor', 1, 1, 0);
    const bed = spawnModule(sim, 'bed', 2, 1, 0);
    const lamp = spawnModule(sim, 'lamp', 3, 1, 0);
    return { sim, bed, lamp };
  }
  const powered = (sim: Sim, id: number): boolean => sim.world.get(id, ModuleC)!.powered;

  it('an idle one draws nothing: it is unpowered and the supply goes to the next consumer', () => {
    const { sim, bed, lamp } = setup();
    sim.step();
    expect(powered(sim, bed)).toBe(false);
    expect(powered(sim, lamp)).toBe(true);
  });

  it('once its rule holds it draws by its priority and can cut the lower ones off', () => {
    const { sim, bed, lamp } = setup();
    sim.world.add(bed, PlotC, { crop: 'c', planted: 'c', grown: 0, need: 10, ready: false });
    sim.step();
    expect(powered(sim, bed)).toBe(true);
    expect(powered(sim, lamp)).toBe(false);
  });
});
