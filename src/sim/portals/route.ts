import { type PathGoal, type Tile } from '../crew/pathfind';
import type { Sim } from '../sim';
import { PortalC, type Portal, type PortalEnd } from './components';
import { portalUsable } from './graph';
import { cachedPath } from './pathCache';

/** Walking legs after the first one: cross `portal`, then walk `steps` (from the far end of the portal). */
export interface Leg {
  portal: number;
  steps: Tile[];
}

/** A planned journey: `steps` on the current grid, then portal crossings each followed by a walk. */
export interface Route {
  steps: Tile[];
  then: Leg[];
}

export interface RouteGoal extends PathGoal {
  gridId: number;
}

export interface RouteStart {
  gridId: number;
  x: number;
  y: number;
}

const ORTHO = 10;
const DIAG = 14;

/** Path cost in the pathfinder's units (an orthogonal step is 10). */
export function stepsCost(from: Tile, steps: readonly Tile[]): number {
  let cost = 0;
  let prev = from;
  for (const s of steps) {
    cost += s.x !== prev.x && s.y !== prev.y ? DIAG : ORTHO;
    prev = s;
  }
  return cost;
}

interface Node {
  key: string;
  at: RouteStart;
  cost: number;
  /** How we got here: the node before, the walk to the portal end, the portal. Null for the start. */
  via: { prev: Node; walk: readonly Tile[]; portal: number } | null;
}

const keyOf = (e: RouteStart): string => `${e.gridId}:${e.x}:${e.y}`;

/**
 * Plan a journey across grids. Same-grid goals use the grid pathfinder directly. Otherwise a Dijkstra runs over the
 * portal graph: nodes are the start and the portal ends, edges are portal traversals (portal.cost) and per-grid walks
 * between ends on the same grid (the grid A*, memoised by cachedPath). The final walk goes from the last portal's far
 * end to the goal. Ties break on cost, then node key, so equal inputs always give the same route. Returns null when
 * the goal is unreachable. `crew` is the traveller (for suit requirements); 0 plans for nobody.
 */
export function planRoute(sim: Sim, crew: number, from: RouteStart, goal: RouteGoal): Route | null {
  const start: Tile = { x: from.x, y: from.y };
  if (from.gridId === goal.gridId) {
    const direct = cachedPath(sim, from.gridId, start, goal);
    if (direct) return { steps: [...direct], then: [] };
  }
  const ids = sim.world.query(PortalC).filter((id) => portalUsable(sim, sim.world.get(id, PortalC) as Portal, crew));
  if (ids.length === 0) return null;

  // Directed edges: [portal id, source end, destination end].
  const edges: { id: number; src: PortalEnd; dst: PortalEnd; portal: Portal }[] = [];
  for (const id of ids) {
    const p = sim.world.get(id, PortalC) as Portal;
    edges.push({ id, src: p.a, dst: p.b, portal: p });
    if (!p.oneWay) edges.push({ id, src: p.b, dst: p.a, portal: p });
  }

  const best = new Map<string, Node>();
  const done = new Set<string>();
  const open: Node[] = [];
  const startNode: Node = { key: keyOf(from), at: from, cost: 0, via: null };
  best.set(startNode.key, startNode);
  open.push(startNode);
  let goalNode: Node | null = null;
  let goalCost = Infinity;
  let goalWalk: readonly Tile[] = [];

  while (open.length > 0) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      const o = open[i] as Node;
      const b = open[bi] as Node;
      if (o.cost < b.cost || (o.cost === b.cost && o.key < b.key)) bi = i;
    }
    const cur = open.splice(bi, 1)[0] as Node;
    if (done.has(cur.key)) continue;
    done.add(cur.key);
    if (cur.cost >= goalCost) break;
    const here: Tile = { x: cur.at.x, y: cur.at.y };

    if (cur.at.gridId === goal.gridId) {
      const walk = cachedPath(sim, goal.gridId, here, goal);
      if (walk) {
        const total = cur.cost + stepsCost(here, walk);
        if (total < goalCost) {
          goalCost = total;
          goalNode = cur;
          goalWalk = walk;
        }
      }
    }
    for (const e of edges) {
      if (e.src.gridId !== cur.at.gridId) continue;
      const walk = cachedPath(sim, e.src.gridId, here, { x: e.src.x, y: e.src.y });
      if (!walk) continue;
      const cost = cur.cost + stepsCost(here, walk) + e.portal.cost;
      const next: RouteStart = { gridId: e.dst.gridId, x: e.dst.x, y: e.dst.y };
      const key = keyOf(next);
      const known = best.get(key);
      if (done.has(key) || (known && known.cost <= cost)) continue;
      const node: Node = { key, at: next, cost, via: { prev: cur, walk, portal: e.id } };
      best.set(key, node);
      open.push(node);
    }
  }
  if (!goalNode) return null;

  // Unwind: collect hops from the goal back to the start.
  const hops: { walk: readonly Tile[]; portal: number }[] = [];
  for (let n: Node | null = goalNode; n?.via; n = n.via.prev) hops.unshift({ walk: n.via.walk, portal: n.via.portal });
  const first = hops[0];
  if (!first) return { steps: [...goalWalk], then: [] };
  const then: Leg[] = hops.map((h, i) => ({
    portal: h.portal,
    steps: [...(i + 1 < hops.length ? (hops[i + 1] as { walk: readonly Tile[] }).walk : goalWalk)],
  }));
  return { steps: [...first.walk], then };
}
