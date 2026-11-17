import { definePart } from '../types';

export interface StationSpec { kind: string; size: 'outpost' | 'station' | 'hub'; seed?: number; owner?: string; /** The camera frames it with the ship. */ frame?: boolean }
export interface NodeSpec {
  /** Ticks to run first: before the first ticks nothing is powered and the helm has no cruise figures (#367), and rooms exist only after them. */
  warm?: number;
  /** Stations spawned beside the ship (one tick each, so the next step sees them). */
  stations?: readonly StationSpec[];
}
declare module '../types' { interface ScenarioSpec { node?: NodeSpec } }

/** The node the scenario starts in: warm-up ticks and stations. */
export default definePart<'node'>({
  key: 'node',
  after: ['ship'],
  apply(ctx, n) {
    if (n.warm) ctx.step(n.warm);
    for (const s of n.stations ?? []) {
      ctx.enqueue({ type: 'debug.spawnStation', kind: s.kind, size: s.size, seed: s.seed ?? 4, ...(s.owner ? { owner: s.owner } : {}) });
      ctx.step();
      if (s.frame) ctx.ui({ kind: 'frame', target: 'station' });
    }
  },
});
