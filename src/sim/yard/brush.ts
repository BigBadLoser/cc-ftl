import type { Sim } from '../sim';
import { Struct } from '../structure';
import { MAX_PLAN, plannedTiles, viewPlan } from './plan';
import { changeViolations, outlineOf, planFootprint } from './width';

type Tile = { x: number; y: number };

const key = (t: Tile): string => `${t.x},${t.y}`;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** What one brush stroke does to the plan: the new outline to send as `hull.plan` (when `error` is null), the plan footprint before and after, and what it breaks. */
export interface BrushResult {
  /** The plan's outline after the stroke (the tiles `hull.plan` takes). */
  outline: Tile[];
  /** The planned footprint (outline plus the floor it shuts in) after the stroke. */
  footprint: Tile[];
  /** Planned tiles the stroke takes out (erase and cut): in the footprint before, not after. Never hull: the plan only holds open space. */
  removed: Tile[];
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

/** True for a tile of the ship's own hull (not an open truss). */
function isShipHull(sim: Sim, ship: number, t: Tile): boolean {
  const g = sim.sector.grid;
  if (t.x < 0 || t.y < 0 || t.x >= sim.sector.width || t.y >= sim.sector.height) return false;
  const k = g.get('struct', t.x, t.y);
  return k !== Struct.Space && k !== Struct.Beam && g.get('ship', t.x, t.y) === ship;
}

/** Judge the planned footprint a stroke leaves (`next`) against the one before: the shared end of every brush. */
function settle(sim: Sim, ship: number, current: readonly Tile[], before: readonly Tile[], next: ReadonlyMap<string, Tile>): BrushResult {
  // The outline decides the footprint: floor the outline and the hull shut in is planned too (a hole erased inside the plan fills itself again).
  const outline = outlineOf(sim, [...next.values()]);
  const footprint = planFootprint(sim, outline);
  const after = new Set(footprint.map(key));
  const unchanged = after.size === before.length && before.every((t) => after.has(key(t)));
  if (unchanged) return { outline: [...current], footprint: [...before], removed: [], bad: [], unchanged: true, error: null };
  const removed = before.filter((t) => !after.has(key(t)));
  const bad = changeViolations(sim, ship, current, outline);
  const error = bad.length ? 'narrowHull' : outline.length > MAX_PLAN ? 'tooBig' : null;
  return { outline, footprint, removed, bad, unchanged: false, error };
}

/**
 * Apply one brush stroke to the ship's plan, without sending it: `tiles` (any shape: a rectangle, either side of a mirror) are put into the planned
 * footprint (`add`, only where the plan may go) or taken out of it (`erase`; real hull is never in the plan, so it is never touched). The result is
 * judged against the 3-wide rule: a stroke that adds violations has `error: 'narrowHull'` and must not be sent. A freehand outline brush is just
 * another source of tiles.
 */
export function brushPlan(sim: Sim, ship: number, mode: 'add' | 'erase', tiles: readonly Tile[]): BrushResult {
  const current = plannedTiles(sim, ship);
  const before = planFootprint(sim, current);
  const inPlan = new Map(before.map((t) => [key(t), t] as const));
  if (mode === 'add') for (const t of tiles) if (planable(sim, ship, t)) inPlan.set(key(t), { x: t.x, y: t.y });
  if (mode === 'erase') for (const t of tiles) inPlan.delete(key(t));
  return settle(sim, ship, current, before, inPlan);
}

/**
 * Cut the plan along a line: the line's planned tiles stay and become the new edge. Only what the cut disconnects goes: tiles that were joined to the
 * ship's hull (4-neighbour chains) before the cut and are cut off from it by the line are removed. Plan pieces that were already detached before the
 * cut stay as they are, and a line that does not meet the plan changes nothing. Several pieces on the ship's side each stay if they still touch the hull.
 * Only the plan is cut, never hull.
 */
export function cutPlan(sim: Sim, ship: number, line: readonly Tile[]): BrushResult {
  const current = plannedTiles(sim, ship);
  const before = planFootprint(sim, current);
  const cut = new Set(line.map(key));
  const all = new Map(before.map((t) => [key(t), t] as const));
  /** Plan tiles joined to the hull by 4-neighbour chains of plan tiles, not stepping on `blocked`. */
  const joined = (blocked: ReadonlySet<string>): Map<string, Tile> => {
    const seen = new Map<string, Tile>();
    const queue: Tile[] = [];
    for (const t of all.values()) {
      if (blocked.has(key(t))) continue;
      if (N4.some(([dx, dy]) => isShipHull(sim, ship, { x: t.x + dx, y: t.y + dy }))) {
        seen.set(key(t), t);
        queue.push(t);
      }
    }
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i] as Tile;
      for (const [dx, dy] of N4) {
        const k = `${c.x + dx},${c.y + dy}`;
        const n = all.get(k);
        if (n && !seen.has(k) && !blocked.has(k)) {
          seen.set(k, n);
          queue.push(n);
        }
      }
    }
    return seen;
  };
  const connectedBefore = joined(new Set());
  const kept = joined(cut);
  const next = new Map<string, Tile>();
  for (const t of before) {
    const k = key(t);
    // a tile goes only when it was connected to the ship before the cut and the cut (not the line's own tile) severs it
    const severed = connectedBefore.has(k) && !kept.has(k) && !cut.has(k);
    if (!severed) next.set(k, t);
  }
  return settle(sim, ship, current, before, next);
}

/**
 * True if a stroke's tiles touch the ship: a tile of it shares an edge with the ship's hull or with planned footprint that is itself connected to the
 * ship (or lies on it). The rectangle brush only puts down connected shapes.
 */
export function touchesShip(sim: Sim, ship: number, tiles: readonly Tile[]): boolean {
  const view = viewPlan(sim, ship);
  const connected = new Set([...view.reachable, ...view.floor].map(key));
  return tiles.some((t) => connected.has(key(t)) || isShipHull(sim, ship, t) || N4.some(([dx, dy]) => {
    const n = { x: t.x + dx, y: t.y + dy };
    return connected.has(key(n)) || isShipHull(sim, ship, n);
  }));
}
