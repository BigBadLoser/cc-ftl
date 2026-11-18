/** Shared setups of the outpost defence tests and their slow tier: a spawned outpost on the starter game, and a run that logs the event types. */
import { ShipC } from '../../../src/sim/combat/components';
import { newGame } from '../../../src/sim/newGame';
import type { OutpostKind } from '../../../src/sim/outposts/gen';
import type { Sim } from '../../../src/sim/sim';
import { content } from '../content';
import { runLog } from '../run';
import { cachedWorld } from '../world';

/** Step `n` times appending the events' log strings to `log` (see `logLine`); returns `log`. */
export function run(sim: Sim, n: number, log: string[] = []): string[] {
  log.push(...runLog(sim, n));
  return log;
}

/** The starter game with one outpost spawned and a step run, built once per file and cloned per call. */
export function spawn(style: 'dug' | 'surface', kind: OutpostKind, seed = 1): { sim: Sim; base: number } {
  const sim = cachedWorld(`outpost:${style}:${kind}:${seed}`, () => {
    const g = newGame(2, content);
    g.enqueue({ type: 'debug.spawnOutpost', style, seed, kind });
    g.step();
    g.events.drain();
    return g;
  });
  return { sim, base: [...sim.world.query(ShipC)].find((id) => sim.world.get(id, ShipC)?.outpost)! };
}
