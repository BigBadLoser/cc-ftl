import { conductanceMap, diffuseStep, fieldFrame, writeBack } from '../diffusion';
import { regions } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { Struct } from '../structure';
import { SMOKE_DECAY_PER_SEC, SMOKE_DIFFUSION, SMOKE_VENT } from '../tuning';

/**
 * Smoke spreads through gas-passable tiles like air, drains into Space through breaches, and
 * thins out by SMOKE_DECAY_PER_SEC once a second. Values are rounded back to the u8 field.
 */
export function smokeSystem(sim: Sim): void {
  const decayNow = sim.tick % TICK_HZ === 0;
  for (const { grid } of regions(sim)) {
    if (!grid.has('smoke') || !grid.has('struct')) continue;
    const frame = fieldFrame(grid);
    const struct = frame.struct;
    const before = grid.load('smoke');
    const smoke = before.slice();
    for (let i = 0; i < struct.length; i++) {
      if (struct[i] === Struct.Space || struct[i] === Struct.Wall) smoke[i] = 0;
    }
    diffuseStep(frame, conductanceMap(grid, frame), [smoke], SMOKE_DIFFUSION, SMOKE_VENT, true);
    if (decayNow) {
      for (let i = 0; i < smoke.length; i++) smoke[i] = Math.max(0, (smoke[i] as number) - SMOKE_DECAY_PER_SEC);
    }
    writeBack(grid, 'smoke', smoke, before, 0.5, true);
  }
}
