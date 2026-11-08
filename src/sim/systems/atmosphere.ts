import { SteadyState, conductanceMap, diffuseStep, fieldFrame, inputKey, fieldMirror, scratchOf, tilesOf, writeBackMirror } from '../diffusion';
import { regions } from '../regions';
import type { Sim } from '../sim';
import { Struct, isAirless, isSolidRock } from '../structure';
import { GAS_DIFFUSION, GAS_EPSILON, GAS_SUBSTEPS, GAS_VENT } from '../tuning';

/** Every field the solve reads. */
const INPUTS = ['o2', 'co2', 'struct', 'door'] as const;
const steady = new SteadyState();
/** Tiles that hold no gas: airless (Space, rock ground), walls and solid rock. */
const holdsNoGas = (kind: number): boolean => isAirless(kind) || kind === Struct.Wall || isSolidRock(kind);

/**
 * Per-tile gas diffusion of O2 and CO2. Floors, open doors (scaled by openness) and Space are
 * gas-passable; walls and closed doors block. Space and rock ground are fixed vacuum sinks, so a floor tile next
 * to Space (a breach) vents fast and the whole connected volume bleeds out through it.
 * Mass is conserved between ordinary tiles. Walls hold no gas (anything left in a freshly built
 * wall is dropped). Runs per region; diffusion visits only the region's active tiles (see diffusion.ts). A region whose
 * last solve wrote nothing and whose inputs are unwritten since is at a fixed point and is skipped (SteadyState).
 */
export function atmosphereSystem(sim: Sim): void {
  for (const { grid } of regions(sim)) {
    if (!grid.has('o2') || !grid.has('struct')) continue;
    const key = inputKey(grid, INPUTS);
    if (steady.quiet(grid, key)) continue;
    const frame = fieldFrame(grid);
    const cond = conductanceMap(grid, frame);
    const o2Before = fieldMirror(grid, 'o2'), co2Before = fieldMirror(grid, 'co2');
    const o2 = scratchOf(grid, 'gas.o2'), co2 = scratchOf(grid, 'gas.co2');
    o2.set(o2Before);
    co2.set(co2Before);
    for (const i of tilesOf(frame, holdsNoGas)) {
      o2[i] = 0;
      co2[i] = 0;
    }
    for (let s = 0; s < GAS_SUBSTEPS; s++) diffuseStep(frame, cond, [o2, co2], GAS_DIFFUSION, GAS_VENT, true);
    const wrote = writeBackMirror(grid, 'o2', o2, o2Before, GAS_EPSILON) + writeBackMirror(grid, 'co2', co2, co2Before, GAS_EPSILON);
    steady.done(grid, key, wrote);
  }
}
