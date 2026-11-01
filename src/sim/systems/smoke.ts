import { SteadyState, conductanceMap, diffuseStep, fieldFrame, inputKey, writeBack } from '../diffusion';
import { regions } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { Struct, isAirless, isSolidRock } from '../structure';
import { SMOKE_DECAY_PER_SEC, SMOKE_DIFFUSION, SMOKE_VENT } from '../tuning';

/** Every field the solve reads (the decay-tick flag is added to the key). */
const INPUTS = ['smoke', 'struct', 'door'] as const;
const steady = new SteadyState();
/** Regions whose last solve wrote nothing over an all-zero smoke field: the zero field, keyed on its `smoke` revision. */
const clear = new SteadyState();

/**
 * Smoke spreads through gas-passable tiles like air, drains into Space through breaches, and
 * thins out by SMOKE_DECAY_PER_SEC once a second. Values are rounded back to the u8 field.
 * Skips (exact): a smoke-free region whose smoke is unwritten since (zero smoke is a fixed point whatever the doors and
 * structure do: every link moves 0 and decay floors at 0), and any region at a fixed point of the same tick kind.
 */
export function smokeSystem(sim: Sim): void {
  const decayNow = sim.tick % TICK_HZ === 0;
  for (const { grid } of regions(sim)) {
    if (!grid.has('smoke') || !grid.has('struct')) continue;
    const zeroKey = [grid.revision('smoke')];
    if (clear.quiet(grid, zeroKey)) continue;
    const key = inputKey(grid, INPUTS, [decayNow ? 1 : 0]);
    if (steady.quiet(grid, key)) continue;
    const frame = fieldFrame(grid);
    const struct = frame.struct;
    const before = grid.load('smoke');
    const smoke = before.slice();
    for (let i = 0; i < struct.length; i++) {
      if (isAirless(struct[i] as number) || struct[i] === Struct.Wall || isSolidRock(struct[i] as number)) smoke[i] = 0;
    }
    diffuseStep(frame, conductanceMap(grid, frame), [smoke], SMOKE_DIFFUSION, SMOKE_VENT, true);
    if (decayNow) {
      for (let i = 0; i < smoke.length; i++) smoke[i] = Math.max(0, (smoke[i] as number) - SMOKE_DECAY_PER_SEC);
    }
    const wrote = writeBack(grid, 'smoke', smoke, before, 0.5, true);
    steady.done(grid, key, wrote);
    clear.done(grid, zeroKey, wrote === 0 && before.every((v) => v === 0) ? 0 : 1);
  }
}
