import { SteadyState, conductanceMap, diffuseStep, mixPairs, fieldFrame, inputKey, fieldMirror, scratchOf, tilesOf, writeBackMirror } from '../diffusion';
import { lifeSupportActs, lifeSupportTick } from '../modules/lifeSupport';
import { regions } from '../regions';
import type { Sim } from '../sim';
import { Struct, isAirless, isSolidRock } from '../structure';
import { GAS_DIFFUSION, GAS_EPSILON, GAS_EVERY, GAS_SUBSTEPS, GAS_VENT } from '../tuningGas';

/** Every field the solve reads. */
const INPUTS = ['o2', 'co2', 'struct', 'door'] as const
const INPUTS_VENT = [...INPUTS, 'vent'] as const;
const steady = new SteadyState();
// PROTOTYPE A/B switch (#65): AIR_PAIRS=1 uses phased pairwise mixing; AIR_PAIR_STEPS / AIR_PAIR_K tune it.
const penv = (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const PAIRS = penv.AIR_PAIRS === '1';
const PAIR_STEPS = Number(penv.AIR_PAIR_STEPS ?? 2);
const PAIR_K = Number(penv.AIR_PAIR_K ?? 0.88);
/** Tiles that hold no gas: airless (Space, rock ground), walls and solid rock. */
const holdsNoGas = (kind: number): boolean => isAirless(kind) || kind === Struct.Wall || isSolidRock(kind);

/**
 * Per-tile gas diffusion of O2 and CO2. Floors, open doors (scaled by openness) and Space are
 * gas-passable; walls and closed doors block. Space and rock ground are fixed vacuum sinks, so a floor tile next
 * to Space (a breach) vents fast and the whole connected volume bleeds out through it.
 * Mass is conserved between ordinary tiles. Walls hold no gas (anything left in a freshly built
 * wall is dropped). Runs per region; diffusion visits only the region's active tiles (see diffusion.ts). A region whose
 * last solve wrote nothing and whose inputs are unwritten since is at a fixed point and is skipped (SteadyState). Each ship solves every
 * GAS_EVERY ticks, on its own phase, running those ticks in turn: each tick's life support (modules/lifeSupport.ts), then its substeps (#65).
 */
export function atmosphereSystem(sim: Sim): void {
  for (const { ship, grid } of regions(sim)) {
    if ((sim.tick + ship) % GAS_EVERY !== 0) continue;
    if (!grid.has('o2') || !grid.has('struct')) continue;
    const key = inputKey(grid, grid.has('vent') ? INPUTS_VENT : INPUTS);
    // At a fixed point, unless life support would top a room up or scrub it (it runs inside the solve, below).
    if (steady.quiet(grid, key) && !lifeSupportActs(sim, ship, grid, fieldMirror(grid, 'o2'), fieldMirror(grid, 'co2'))) continue;
    const frame = fieldFrame(grid);
    const cond = conductanceMap(grid, frame, true);
    const o2Before = fieldMirror(grid, 'o2'), co2Before = fieldMirror(grid, 'co2');
    const o2 = scratchOf(grid, 'gas.o2'), co2 = scratchOf(grid, 'gas.co2');
    o2.set(o2Before);
    co2.set(co2Before);
    const noGas = tilesOf(frame, holdsNoGas);
    // The ticks this solve covers, one at a time: that tick's life support, then its substeps (so a top-up capped at NORMAL_O2 spreads before the next).
    for (let t = 0; t < GAS_EVERY; t++) {
      lifeSupportTick(sim, ship, grid, o2, co2);
      // Tiles that hold no gas are emptied after life support, which may stand on airless ground with no room (it would add oxygen to
      // its own tile), and before the substeps, where an airless tile is a fixed sink (#570 review).
      for (const i of noGas) {
        o2[i] = 0;
        co2[i] = 0;
      }
      if (PAIRS) for (let s = 0; s < PAIR_STEPS; s++) mixPairs(frame, cond, o2, co2, GAS_DIFFUSION * PAIR_K, GAS_VENT * PAIR_K, (sim.tick + t) * PAIR_STEPS + s);
      else for (let s = 0; s < GAS_SUBSTEPS; s++) diffuseStep(frame, cond, [o2, co2], GAS_DIFFUSION, GAS_VENT, true);
    }
    const wrote = writeBackMirror(grid, 'o2', o2, o2Before, GAS_EPSILON) + writeBackMirror(grid, 'co2', co2, co2Before, GAS_EPSILON);
    steady.done(grid, key, wrote);
  }
}
