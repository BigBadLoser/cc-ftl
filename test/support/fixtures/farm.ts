import { ShipC } from '../../../src/sim/combat/components';
import { CrewC, JobC, NeedsC } from '../../../src/sim/crew/components';
import { PlotC } from '../../../src/sim/farm/components';
import { ModuleC } from '../../../src/sim/modules/components';
import { accessTile, footprintTiles } from '../../../src/sim/modules/footprint';
import { placementError, spawnModule } from '../../../src/sim/modules/spawn';
import { newGame } from '../../../src/sim/newGame';
import type { Sim } from '../../../src/sim/sim';
import { TICK_HZ } from '../../../src/sim/time';
import { playerShip } from '../../../src/sim/trade/player';
import { content } from '../content';
import { run } from '../run';
import { cachedWorld } from '../world';

export const secs = (n: number): number => Math.round(n * TICK_HZ);
export const humans = (sim: Sim): number[] => sim.world.query(CrewC).filter((id) => sim.world.get(id, CrewC)?.species === 'species.human');
export const find = (sim: Sim, def: string): number => sim.world.query(ModuleC).find((id) => sim.world.get(id, ModuleC)?.def === def) as number;
export const plotOf = (sim: Sim, id: number) => sim.world.get(id, PlotC)!;
export const jobKinds = (sim: Sim): string[] => sim.world.query(JobC).map((j) => sim.world.get(j, JobC)!.kind);

/** A free spot (with the walkway beside it, off every other module's access tile) for a module, scanning the ship from its top-left. */
export function bedAt(sim: Sim, def = 'module.hydroponics'): number {
  const ship = playerShip(sim) as number;
  const at = sim.world.get(ship, ShipC)!;
  const d = content.modules[def as 'module.hydroponics'];
  const access = new Set(sim.world.query(ModuleC).map((id) => {
    const m = sim.world.get(id, ModuleC)!;
    const a = accessTile(content.modules[m.def as 'module.hydroponics'], m.x, m.y, m.rot);
    return a ? `${a.x},${a.y}` : '';
  }));
  const blocks = (x: number, y: number): boolean => footprintTiles(d, x, y, 0).some((t) => access.has(`${t.x},${t.y}`));
  for (let y = at.y; y < at.y + at.height; y++) {
    for (let x = at.x; x < at.x + at.width; x++) if (placementError(sim, ship, def, x, y, 0) === null && !blocks(x, y)) return spawnModule(sim, def, x, y, 0);
  }
  throw new Error('no room for the bed');
}

/** The starter game with the larder emptied of everything but what a test adds, one bed, and the crew fed so only the test's crew member acts (built once per test file, cloned per call). */
export function farmGame(): { sim: Sim; bed: number; crew: number[] } {
  const sim = cachedWorld('farm:game', () => {
    const g = newGame(3, content);
    run(g, 5);
    farmBed = bedAt(g);
    for (const h of humans(g)) {
      g.world.get(h, NeedsC)!.hunger = 100;
      g.world.get(h, NeedsC)!.rest = 100;
    }
    return g;
  });
  return { sim, bed: farmBed, crew: humans(sim) };
}
let farmBed = 0;
