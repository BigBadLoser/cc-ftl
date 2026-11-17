import { ShipC, homeShip, nodeOf } from '../../../sim';
import { adjacentNodes, deployShip } from '../lib/trip';
import { definePart } from '../types';

export interface StationSpec { kind: string; size: 'outpost' | 'station' | 'hub'; seed?: number; owner?: string; /** The camera frames it with the ship. */ frame?: boolean }
export interface NodeSpec {
  /** Ticks to run first: before the first ticks nothing is powered and the helm has no cruise figures (#367), and rooms exist only after them. */
  warm?: number;
  /** Move to the first neighbouring node with no structures (the start node's station leaves no room for a raider) and deploy where the ship was. */
  relocate?: boolean;
  /** Stations spawned beside the ship (one tick each, so the next step sees them). */
  stations?: readonly StationSpec[];
}
declare module '../types' { interface ScenarioSpec { node?: NodeSpec } }

/** The node the scenario starts in: warm-up ticks, a hop to an empty neighbour, and stations. */
export default definePart<'node'>({
  key: 'node',
  after: ['ship'],
  apply(ctx, n) {
    const { sim } = ctx;
    if (n.warm) ctx.step(n.warm);
    if (n.relocate) {
      const here = sim.galaxy.current;
      const next = adjacentNodes(sim, here).find((id) => !nodeOf(sim, id)?.structures.length) ?? here;
      const at = sim.world.get(homeShip(sim), ShipC);
      if (next !== here) {
        ctx.enqueue({ type: 'debug.galaxyTeleport', node: next });
        ctx.until(() => sim.sector.state === 'deploying', 200, 'the hop to an empty node');
        deployShip(ctx, [...(at ? [[at.x, at.y] as const] : []), [20, 50], [100, 60], [60, 90], [150, 40], [10, 10]]);
      }
    }
    for (const s of n.stations ?? []) {
      // A populated start node may have no room for this one's size at this seed: the next seeds make other layouts.
      for (let tries = 0; tries < 8; tries++) {
        const before = sim.world.query(ShipC).length;
        ctx.enqueue({ type: 'debug.spawnStation', kind: s.kind, size: s.size, seed: (s.seed ?? 4) + tries, ...(s.owner ? { owner: s.owner } : {}) });
        ctx.step();
        if (sim.world.query(ShipC).length > before) break;
      }
      if (s.frame) ctx.ui({ kind: 'frame', target: 'station' });
    }
  },
});
