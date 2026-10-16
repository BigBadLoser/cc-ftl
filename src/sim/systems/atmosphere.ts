import { conductanceMap, diffuseStep, loadField, writeBack } from '../diffusion';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { GAS_DIFFUSION, GAS_EPSILON, GAS_SUBSTEPS, GAS_VENT } from '../tuning';

/**
 * Per-tile gas diffusion of O2 and CO2. Floors, open doors (scaled by openness) and Space are
 * gas-passable; walls and closed doors block. Space is a fixed vacuum sink, so a floor tile next
 * to Space (a breach) vents fast and the whole connected volume bleeds out through it.
 * Mass is conserved between ordinary tiles. Walls hold no gas (anything left in a freshly built
 * wall is dropped).
 */
export function atmosphereSystem(sim: Sim): void {
  for (const grid of sim.grids.values()) {
    if (!grid.has('o2') || !grid.has('struct')) continue;
    const struct = grid.raw('struct');
    const cond = conductanceMap(grid);
    const o2 = loadField(grid, 'o2');
    const co2 = loadField(grid, 'co2');
    for (let i = 0; i < struct.length; i++) {
      if (struct[i] === Struct.Space || struct[i] === Struct.Wall) {
        o2[i] = 0;
        co2[i] = 0;
      }
    }
    for (let s = 0; s < GAS_SUBSTEPS; s++) diffuseStep(grid, cond, [o2, co2], GAS_DIFFUSION, GAS_VENT, true);
    writeBack(grid, 'o2', o2, GAS_EPSILON);
    writeBack(grid, 'co2', co2, GAS_EPSILON);
  }
}
