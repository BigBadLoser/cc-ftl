import { afterEach, describe, expect, it, vi } from 'vitest';
import { stampShip } from '../combat/ships';
import { ShipC, type Ship } from '../combat/components';
import { ModuleC, type Module } from '../modules/components';
import { removeModule, spawnModule } from '../modules/spawn';
import type { ContentRegistry, ModuleDef } from '../registry';
import { shipGrid } from '../regions';
import { ShipGrid } from '../shipGrid';
import { Sim } from '../sim';
import { Struct } from '../structure';
import { atmosphereSystem } from './atmosphere';
import { lightingSystem } from './lighting';
import { roomsSystem } from './rooms';
import { smokeSystem } from './smoke';

/**
 * Change tracking of the environment solvers: once a region has settled, a solve is skipped, and every kind of edit to what
 * the solver reads makes it solve again. A solve shows up as a `load` of the solver's own field.
 */

const lamp: ModuleDef = {
  name: 'lamp', asset: 'lamp', footprint: [1, 1], solid: false, power: 0, flammability: 0, maxHp: 10, buildWork: 1,
  light: { radius: 3, level: 200 },
};
const content: ContentRegistry = {
  ships: {}, roles: {}, species: {}, modules: { lamp }, crewNames: [], items: {}, recipes: {}, structCosts: {},
};

// Two rooms joined by a shut door at (5, 2), in a sealed hull.
const rows = ['...........', '.#########.', '.#___D___#.', '.#___#___#.', '.#########.', '...........'];

function make(): { sim: Sim; ship: number; grid: ShipGrid; lampId: number } {
  const sim = new Sim(3, content);
  const ship = stampShip(sim, { name: 't', rows }, { faction: 'player', state: 'prize', x: 0, y: 0 });
  const lampId = spawnModule(sim, 'lamp', 3, 2, 0);
  (sim.world.get(lampId, ModuleC) as Module).powered = true;
  roomsSystem(sim);
  return { sim, ship, grid: shipGrid(sim, ship) as ShipGrid, lampId };
}

/** How many times `field` is loaded from a ship view while `fn` runs. */
function loads(field: string, fn: () => void): number {
  let n = 0;
  const load = ShipGrid.prototype.load;
  const spy = vi.spyOn(ShipGrid.prototype, 'load').mockImplementation(function (this: ShipGrid, f, rect) {
    if (f === field) n++;
    return load.call(this, f, rect);
  });
  fn();
  spy.mockRestore();
  return n;
}

/** Run `system` until a call skips its solve (no load of `field`); fail if it never settles. */
function settle(sim: Sim, system: (sim: Sim) => void, field: string): void {
  for (let i = 0; i < 2000; i++) if (loads(field, () => system(sim)) === 0) return;
  throw new Error(`${system.name} never settled`);
}

afterEach(() => vi.restoreAllMocks());

describe('diffusion solvers skip a settled region and wake on every input', () => {
  const cases = [
    { system: atmosphereSystem, field: 'o2', edits: ['o2', 'co2', 'struct', 'door'] },
  ] as const;
  for (const { system, field, edits } of cases) {
    for (const edit of edits) {
      it(`${system.name} solves again after a ${edit} write`, () => {
        const { sim, grid } = make();
        settle(sim, system, field);
        expect(loads(field, () => system(sim))).toBe(0);
        if (edit === 'struct') grid.set('struct', 1, 2, Struct.Space); // a breach in the west hull
        else if (edit === 'door') grid.set('door', 5, 2, 255);
        else grid.set(edit, 2, 3, grid.get(edit, 2, 3) + 1);
        expect(loads(field, () => system(sim))).toBe(1);
      });
    }
  }

  it('smoke skips a smoke-free region whatever the doors and structure do, and wakes on smoke', () => {
    const { sim, grid } = make();
    settle(sim, smokeSystem, 'smoke');
    grid.set('door', 5, 2, 255);
    grid.set('struct', 1, 2, Struct.Space);
    expect(loads('smoke', () => smokeSystem(sim))).toBe(0);
    grid.set('smoke', 3, 3, 90);
    expect(loads('smoke', () => smokeSystem(sim))).toBe(1);
  });
});

describe('lighting skips an unchanged region and wakes on every input', () => {
  const edits: Record<string, (s: ReturnType<typeof make>) => void> = {
    'lamp unpowered': ({ sim, lampId }) => void ((sim.world.get(lampId, ModuleC) as Module).powered = false),
    'lamp wrecked': ({ sim, lampId }) => void ((sim.world.get(lampId, ModuleC) as Module).hp = 0),
    'lamp removed': ({ sim, lampId }) => removeModule(sim, lampId),
    'lamp added': ({ sim }) => void ((sim.world.get(spawnModule(sim, 'lamp', 7, 3, 0), ModuleC) as Module).powered = true),
    'door opened': ({ grid }) => grid.set('door', 5, 2, 255),
    'struct written': ({ grid }) => grid.set('struct', 5, 2, Struct.Wall),
    'room written': ({ grid }) => grid.set('room', 4, 3, 0),
    'light written': ({ grid }) => grid.set('light', 2, 2, 7),
    'ship wrecked': ({ sim, ship }) => void ((sim.world.get(ship, ShipC) as Ship).state = 'wreck'),
  };
  for (const [name, edit] of Object.entries(edits)) {
    it(`solves again after: ${name}`, () => {
      const s = make();
      expect(loads('light', () => lightingSystem(s.sim))).toBe(1);
      expect(loads('light', () => lightingSystem(s.sim))).toBe(0);
      edit(s);
      expect(loads('light', () => lightingSystem(s.sim))).toBe(1);
    });
  }

  it('a door moving without opening or shutting changes nothing it reads: still skipped', () => {
    const s = make();
    s.grid.set('door', 5, 2, 100);
    lightingSystem(s.sim);
    s.grid.set('door', 5, 2, 200);
    expect(loads('light', () => lightingSystem(s.sim))).toBe(0);
  });
});
