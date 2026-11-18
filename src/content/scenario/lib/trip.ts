import { galaxyIndex, type Sim } from '../../../sim';
import type { BuildCtx } from '../types';

/** Free spots to try for a deployment, in order (a rejected one overlaps something). */
export const DEPLOY_SPOTS = [[100, 60], [20, 50], [300, 200], [40, 150], [200, 20], [350, 100]] as const;

/** The node ids beside `id`, sorted. */
export const adjacentNodes = (sim: Sim, id: string): string[] => (galaxyIndex(sim.galaxy).adjacent.get(id) ?? []).map((e) => (e.a === id ? e.b : e.a)).sort();

/** `hops` nodes out from the current one, always taking the first neighbour (by id) not already on the route. */
export function routeOf(sim: Sim, hops: number): string[] {
  const route = [sim.galaxy.current];
  for (let h = 0; h < hops; h++) {
    const next = adjacentNodes(sim, route[route.length - 1] as string).find((n) => !route.includes(n));
    if (!next) break;
    route.push(next);
  }
  return route.slice(1);
}

/** Deploy the ship at the first free of `spots`, once the node asks for it. */
export function deployShip(ctx: BuildCtx, spots: readonly (readonly [number, number])[] = DEPLOY_SPOTS): void {
  for (const [x, y] of spots) {
    ctx.enqueue({ type: 'sector.deploy', x, y });
    ctx.step();
    if (ctx.sim.sector.state === 'active') return;
  }
}
