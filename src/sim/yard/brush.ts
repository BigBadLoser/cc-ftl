import type { Sim } from '../sim';
import { Struct } from '../structure';
import { MAX_PLAN, plannedTiles } from './plan';
import { changeViolations, outlineOf, planFootprint } from './width';

type Tile = { x: number; y: number };

const key = (t: Tile): string => `${t.x},${t.y}`;

/** What one brush stroke does to the plan: the new outline to send as `hull.plan` (when `ok`), the plan footprint before and after, and what it breaks. */
export interface BrushResult {
  /** The plan's outline after the stroke (the tiles `hull.plan` takes). */
  outline: Tile[];
  /** The planned footprint (outline plus the floor it shuts in) after the stroke. */
  footprint: Tile[];
  /** Tiles the stroke would leave narrower than 3: the new violations only. */
  bad: Tile[];
  /** The stroke changes nothing (it only covers hull, other structure or what is already planned, or erases nothing). */
  unchanged: boolean;
  /** Reason code when it cannot apply: `narrowHull` or `tooBig`; null when it can. */
  error: 'narrowHull' | 'tooBig' | null;
}

/** True where a plan tile may go: open space, or the ship's own truss. */
function planable(sim: Sim, ship: number, t: Tile): boolean {
  const g = sim.sector.grid;
  if (t.x < 0 || t.y < 0 || t.x >= sim.sector.width || t.y >= sim.sector.height) return false;
  const k = g.get('struct', t.x, t.y);
  return (k === Struct.Space && g.get('ship', t.x, t.y) === 0) || (k === Struct.Beam && g.get('ship', t.x, t.y) === ship);
}

/**
 * Apply one brush stroke to the ship's plan, without sending it: `tiles` (any shape: a rectangle, a staircase, either side of a mirror) are put into the planned
 * footprint (`add`, only where the plan may go) or taken out of it (`erase`; real hull stays). The result is judged against the 3-wide rule: a stroke that adds
 * violations has `error: 'narrowHull'` and must not be sent. This is all the build tool's brushes need, so a freehand outline brush is just another source of tiles.
 */
export function brushPlan(sim: Sim, ship: number, mode: 'add' | 'erase', tiles: readonly Tile[]): BrushResult {
  const current = plannedTiles(sim, ship);
  const before = planFootprint(sim, current);
  const inPlan = new Map(before.map((t) => [key(t), t] as const));
  if (mode === 'add') for (const t of tiles) if (planable(sim, ship, t)) inPlan.set(key(t), { x: t.x, y: t.y });
  if (mode === 'erase') for (const t of tiles) inPlan.delete(key(t));
  const next = [...inPlan.values()];
  const outline = outlineOf(sim, next);
  const unchanged = inPlan.size === before.length && before.every((t) => inPlan.has(key(t)));
  const footprint = planFootprint(sim, outline);
  if (unchanged) return { outline: current, footprint: before, bad: [], unchanged: true, error: null };
  const bad = changeViolations(sim, ship, current, outline);
  const error = bad.length ? 'narrowHull' : outline.length > MAX_PLAN ? 'tooBig' : null;
  return { outline, footprint, bad, unchanged: false, error };
}
