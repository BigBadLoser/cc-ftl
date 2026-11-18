import { describe, expect, it } from 'vitest';
import { ShipC } from '../sim/combat/components';
import { ModuleC } from '../sim/modules/components';
import { placementError, spawnModule } from '../sim/modules/spawn';
import { newGame } from '../sim/newGame';
import type { Sim } from '../sim/sim';
import { TICK_HZ } from '../sim/time';
import { playerShip } from '../sim/trade/player';
import { content } from '../content';
import { buildFood } from './foodSnapshot';
import { buildStock } from './logisticsSnapshot';
import { buildPlot } from './plotSnapshot';
import { step as run } from '../../test/support/sim';


function bed(sim: Sim): number {
  const ship = playerShip(sim) as number;
  const at = sim.world.get(ship, ShipC)!;
  for (let y = at.y; y < at.y + at.height; y++) {
    for (let x = at.x; x < at.x + at.width; x++) if (placementError(sim, ship, 'module.hydroponics', x, y, 0) === null) return spawnModule(sim, 'module.hydroponics', x, y, 0);
  }
  throw new Error('no room');
}

describe('buildPlot', () => {
  it('says what a bed waits for', () => {
    const sim = newGame(3, content);
    run(sim, 3);
    const id = bed(sim);
    expect(buildPlot(sim, id)).toMatchObject({ crop: null, state: 'fallow', note: 'Pick a crop to sow' });
    sim.enqueue({ type: 'plot.setCrop', moduleId: id, crop: 'crop.greens' });
    sim.enqueue({ type: 'debug.setPlot', moduleId: id, crop: 'crop.greens', grown: 100 });
    run(sim, 5 * TICK_HZ);
    expect(buildPlot(sim, id)).toMatchObject({ state: 'growing', plantedName: 'Greens' });
    expect(buildPlot(sim, id)?.note).toMatch(/Growing: \d+:\d\d left/);
    sim.enqueue({ type: 'module.setEnabled', id, enabled: false });
    run(sim, 3);
    expect(buildPlot(sim, id)?.note).toMatch(/No power/);
    expect(sim.world.get(id, ModuleC)).toBeDefined();
  });

  it.each(['ship.wayfarer', 'ship.prospector', 'ship.lancer'])('%s starts with an hour or more of food aboard', (ship) => {
    const sim = newGame(3, content, ship);
    run(sim, 3);
    expect(buildFood(sim, buildStock(sim)).hours as number).toBeGreaterThanOrEqual(1);
  });
});
