import { SteadyState, conductanceMap, diffuseStep, fieldFrame, inputKey, fieldMirror, scratchOf, tilesOf, writeBackMirror } from '../diffusion';
import { regions } from '../regions';
import type { Sim } from '../sim';
import { Struct, isAirless } from '../structure';
import { NORMAL_TEMP, SPACE_TEMP, TEMP_AMBIENT_LOSS, TEMP_DIFFUSION, TEMP_EVERY, TEMP_VENT } from '../tuning';

const TEMP_EPSILON = 1e-3;
/** Every field the solve reads. */
const INPUTS = ['temp', 'struct', 'door'] as const;
const steady = new SteadyState();
/** One solve covers TEMP_EVERY ticks: rates scaled, the per-tick ambient loss compounded. */
const K = TEMP_DIFFUSION * TEMP_EVERY, K_VENT = TEMP_VENT * TEMP_EVERY;
const AMBIENT = 1 - (1 - TEMP_AMBIENT_LOSS) ** TEMP_EVERY;
/** Air tiles that relax toward NORMAL_TEMP: floors and doors. */
const holdsAir = (kind: number): boolean => kind === Struct.Floor || kind === Struct.Door;

/**
 * Temperature diffuses across the same gas-passable links as the air (a breach drains heat to
 * Space, which is pinned at SPACE_TEMP), and every air tile relaxes slowly toward NORMAL_TEMP
 * (radiators). Fire and reactors add their heat directly to the field earlier in the tick.
 * A region at a fixed point (last solve wrote nothing, inputs unwritten since) is skipped (SteadyState). Each region solves every
 * TEMP_EVERY ticks, on the tick its ship id picks, with a step that long (#65): heat added in between is spread on its next solve.
 */
export function temperatureSystem(sim: Sim): void {
  for (const { ship, grid } of regions(sim)) {
    if ((sim.tick + ship) % TEMP_EVERY !== 0) continue;
    if (!grid.has('temp') || !grid.has('struct')) continue;
    const key = inputKey(grid, INPUTS);
    if (steady.quiet(grid, key)) continue;
    const frame = fieldFrame(grid);
    const cond = conductanceMap(grid, frame);
    const before = fieldMirror(grid, 'temp'), temp = scratchOf(grid, 'temp.next');
    temp.set(before);
    for (const i of tilesOf(frame, isAirless)) temp[i] = SPACE_TEMP;
    diffuseStep(frame, cond, [temp], K, K_VENT, false);
    for (const i of tilesOf(frame, holdsAir)) temp[i] = (temp[i] as number) + (NORMAL_TEMP - (temp[i] as number)) * AMBIENT;
    steady.done(grid, key, writeBackMirror(grid, 'temp', temp, before, TEMP_EPSILON));
  }
}
