import { conductanceMap, diffuseStep, loadField, writeBack } from '../diffusion';
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
  for (const grid of sim.grids.values()) {
    if (!grid.has('smoke') || !grid.has('struct')) continue;
    const struct = grid.raw('struct');
    const smoke = loadField(grid, 'smoke');
    for (let i = 0; i < struct.length; i++) {
      if (struct[i] === Struct.Space || struct[i] === Struct.Wall) smoke[i] = 0;
    }
    diffuseStep(grid, conductanceMap(grid), [smoke], SMOKE_DIFFUSION, SMOKE_VENT, true);
    if (decayNow) {
      for (let i = 0; i < smoke.length; i++) smoke[i] = Math.max(0, (smoke[i] as number) - SMOKE_DECAY_PER_SEC);
    }
    writeBack(grid, 'smoke', smoke, 0.5, true);
  }
}
