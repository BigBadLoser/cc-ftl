import type { Rect } from '../grid';
import { asteroidGapError } from '../regions';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { AsteroidC } from './components';
import type { AsteroidPlan } from './types';

/** A plan's rock body bboxes moved to a sector top-left (x, y). */
export function placedParts(plan: AsteroidPlan, x: number, y: number): Rect[] {
  return plan.parts.map((p) => ({ x: p.x + x, y: p.y + y, w: p.w, h: p.h }));
}

/**
 * Stamp an asteroid with its top-left at sector (x, y): a new `AsteroidC` entity, and its rock tiles written through the grid
 * API (`struct`, `ore`, `oreAmt`, and the entity as the `ship`-layer owner). Only rock tiles are written, so Space inside a
 * field's bbox is left alone. Returns the asteroid id. Throws if the spot breaks the gap rule (commands check
 * `asteroidGapError` first). Asteroids are stamped like ships but are not ships: no `ShipC`, so no field systems run on them.
 */
export function stampAsteroid(sim: Sim, plan: AsteroidPlan, x: number, y: number): number {
  const parts = placedParts(plan, x, y);
  const gap = asteroidGapError(sim, parts);
  if (gap) throw new Error(`stampAsteroid ${plan.kind} #${plan.seed} at (${x}, ${y}): ${gap}`);
  const id = sim.world.createEntity();
  const core = plan.core ? { x: plan.core.x + x, y: plan.core.y + y, w: plan.core.w, h: plan.core.h } : null;
  sim.world.add(id, AsteroidC, { kind: plan.kind, seed: plan.seed, hollow: plan.hollow, x, y, width: plan.w, height: plan.h, parts, core });
  const grid = sim.sector.grid;
  for (let ly = 0; ly < plan.h; ly++) {
    for (let lx = 0; lx < plan.w; lx++) {
      const i = ly * plan.w + lx;
      const kind = plan.struct[i] as number;
      if (kind === Struct.Space) continue;
      // struct first, so the chunk exists before its other fields are written
      grid.set('struct', x + lx, y + ly, kind);
      if (grid.get('hp', x + lx, y + ly) !== 0) grid.set('hp', x + lx, y + ly, 0);
      grid.set('ship', x + lx, y + ly, id);
      if (plan.ore[i]) {
        grid.set('ore', x + lx, y + ly, plan.ore[i] as number);
        grid.set('oreAmt', x + lx, y + ly, plan.amt[i] as number);
      }
    }
  }
  return id;
}

/**
 * The first top-left (scanning rows from the sector's top-left in `step`-tile strides) where the plan fits inside the sector
 * and passes the gap rule, or null.
 */
export function findAsteroidSpot(sim: Sim, plan: AsteroidPlan, step = 4): { x: number; y: number } | null {
  for (let y = 0; y + plan.h <= sim.sector.height; y += step) {
    for (let x = 0; x + plan.w <= sim.sector.width; x += step) if (!asteroidGapError(sim, placedParts(plan, x, y))) return { x, y };
  }
  return null;
}
