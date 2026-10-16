import { conductanceMap, diffuseStep, loadField, writeBack } from '../diffusion';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { NORMAL_TEMP, SPACE_TEMP, TEMP_AMBIENT_LOSS, TEMP_DIFFUSION, TEMP_VENT } from '../tuning';

const TEMP_EPSILON = 1e-3;

/**
 * Temperature diffuses across the same gas-passable links as the air (a breach drains heat to
 * Space, which is pinned at SPACE_TEMP), and every air tile relaxes slowly toward NORMAL_TEMP
 * (radiators). Fire and reactors add their heat directly to the field earlier in the tick.
 */
export function temperatureSystem(sim: Sim): void {
  for (const grid of sim.grids.values()) {
    if (!grid.has('temp') || !grid.has('struct')) continue;
    const struct = grid.raw('struct');
    const cond = conductanceMap(grid);
    const temp = loadField(grid, 'temp');
    for (let i = 0; i < struct.length; i++) if (struct[i] === Struct.Space) temp[i] = SPACE_TEMP;
    diffuseStep(grid, cond, [temp], TEMP_DIFFUSION, TEMP_VENT, false);
    for (let i = 0; i < struct.length; i++) {
      const kind = struct[i];
      if (kind === Struct.Floor || kind === Struct.Door) {
        temp[i] = (temp[i] as number) + (NORMAL_TEMP - (temp[i] as number)) * TEMP_AMBIENT_LOSS;
      }
    }
    writeBack(grid, 'temp', temp, TEMP_EPSILON);
  }
}
