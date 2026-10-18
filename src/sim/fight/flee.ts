import { isTileWalkable } from '../modules/walk';
import { findPath } from '../crew/pathfind';
import type { Grid } from '../grid';
import type { Sim } from '../sim';
import { FLEE_RADIUS } from '../tuning';
import { sightLine, type Cell } from './los';

const FLEE_CANDIDATES = 20;
const TRIES = 6;
/** Bonus for a hiding place the nearest threat cannot see. */
const HIDDEN_BONUS = 8;

/** Steps to the best safe tile within FLEE_RADIUS: far from every threat, close to us, ideally out of sight. Null when cornered. */
export function fleePath(sim: Sim, grid: Grid, from: Cell, threats: Cell[]): Cell[] | null {
  if (threats.length === 0) return null;
  const nearest = (c: Cell): { d: number; at: Cell } => {
    let best = { d: Infinity, at: threats[0] as Cell };
    for (const t of threats) {
      const d = Math.hypot(t.x - c.x, t.y - c.y);
      if (d < best.d) best = { d, at: t };
    }
    return best;
  };
  const scored: { x: number; y: number; score: number }[] = [];
  for (let dy = -FLEE_RADIUS; dy <= FLEE_RADIUS; dy++) {
    for (let dx = -FLEE_RADIUS; dx <= FLEE_RADIUS; dx++) {
      const x = from.x + dx;
      const y = from.y + dy;
      if ((dx === 0 && dy === 0) || !isTileWalkable(sim, grid, x, y)) continue;
      scored.push({ x, y, score: nearest({ x, y }).d * 2 - Math.hypot(dx, dy) * 0.5 });
    }
  }
  const order = (a: { x: number; y: number; score: number }, b: { x: number; y: number; score: number }): number =>
    b.score - a.score || a.y - b.y || a.x - b.x;
  scored.sort(order);
  const top = scored.slice(0, FLEE_CANDIDATES);
  for (const c of top) if (!sightLine(sim, grid, nearest(c).at, c).visible) c.score += HIDDEN_BONUS;
  top.sort(order);
  for (const c of top.slice(0, TRIES)) {
    const steps = findPath(sim, grid.id, from, c);
    if (steps && steps.length > 0) return steps;
  }
  return null;
}
