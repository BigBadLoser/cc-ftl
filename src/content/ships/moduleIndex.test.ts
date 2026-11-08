import { describe, expect, it } from 'vitest';
import { ModuleC, newGame, ShipC, shipIdOf, type Module, type Sim } from '../../sim';
import { modulesOn, modulesWhere, moduleShip, type DefTest } from '../../sim/modules/byShip';
import { removeModule, spawnModule } from '../../sim/modules/spawn';
import { spawnStation } from '../../sim/stations/spawn';
import { content } from '../index';

/** The module index must answer exactly what a scan of every module with `shipIdOf` does. */
const tests: (DefTest | null)[] = [null, (d) => d.console === 'helm', (d) => !!d.engine, (d) => !!d.light];

function expectMatchesScan(sim: Sim): void {
  for (const test of tests) {
    const scan = sim.world.query(ModuleC).filter((id) => {
      const def = sim.content.modules[(sim.world.get(id, ModuleC) as Module).def];
      return !!def && (!test || test(def));
    });
    const list = modulesWhere(sim, test);
    expect(list.ids).toEqual(scan);
    expect(list.ships).toEqual(scan.map((id) => shipIdOf(sim, sim.world.get(id, ModuleC))));
    for (const ship of [0, ...sim.world.query(ShipC)]) {
      expect(modulesOn(sim, ship, test)).toEqual(scan.filter((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === ship));
    }
  }
  for (const id of sim.world.query(ModuleC)) expect(moduleShip(sim, id)).toBe(shipIdOf(sim, sim.world.get(id, ModuleC)));
}

describe('module index', () => {
  it('follows module, ship and rectangle changes', () => {
    const sim = newGame(1, content, undefined, false);
    expectMatchesScan(sim);
    expect(typeof spawnStation(sim, Object.keys(content.stations ?? {})[0] as string, 'outpost', 3)).toBe('number');
    expectMatchesScan(sim);
    const first = sim.world.query(ModuleC)[0] as number;
    const m = sim.world.get(first, ModuleC) as Module;
    const lamp = spawnModule(sim, m.def, m.x, m.y, m.rot);
    expectMatchesScan(sim);
    removeModule(sim, lamp);
    removeModule(sim, first);
    expectMatchesScan(sim);
    // A ship whose rectangle shrinks: modules outside it now resolve another way.
    const home = sim.world.query(ShipC)[0] as number;
    const s = sim.world.get(home, ShipC);
    if (s) s.width = Math.max(1, s.width - 6);
    expectMatchesScan(sim);
  });
});
