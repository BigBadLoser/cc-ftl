import { conductanceMap, diffuseStep, fieldFrame, writeBack } from '../diffusion';
import { regions } from '../regions';
import type { Sim } from '../sim';
import { Struct, isAirless, isSolidRock } from '../structure';
import { GAS_DIFFUSION, GAS_EPSILON, GAS_SUBSTEPS, GAS_VENT } from '../tuning';

/**
 * Per-tile gas diffusion of O2 and CO2. Floors, open doors (scaled by openness) and Space are
 * gas-passable; walls and closed doors block. Space and rock ground are fixed vacuum sinks, so a floor tile next
 * to Space (a breach) vents fast and the whole connected volume bleeds out through it.
 * Mass is conserved between ordinary tiles. Walls hold no gas (anything left in a freshly built
 * wall is dropped). Runs per region; diffusion visits only the region's active tiles (see diffusion.ts).
 */
export function atmosphereSystem(sim: Sim): void {
  for (const { grid } of regions(sim)) {
    if (!grid.has('o2') || !grid.has('struct')) continue;
    const frame = fieldFrame(grid);
    const struct = frame.struct;
    const cond = conductanceMap(grid, frame);
    const o2Before = grid.load('o2');
    const co2Before = grid.load('co2');
    const o2 = o2Before.slice();
    const co2 = co2Before.slice();
    for (let i = 0; i < struct.length; i++) {
      if (isAirless(struct[i] as number) || struct[i] === Struct.Wall || isSolidRock(struct[i] as number)) {
        o2[i] = 0;
        co2[i] = 0;
      }
    }
    for (let s = 0; s < GAS_SUBSTEPS; s++) diffuseStep(frame, cond, [o2, co2], GAS_DIFFUSION, GAS_VENT, true);
    writeBack(grid, 'o2', o2, o2Before, GAS_EPSILON);
    writeBack(grid, 'co2', co2, co2Before, GAS_EPSILON);
  }
}
