import { ShipC } from '../../../src/sim/combat/components';
import { homeShip } from '../../../src/sim/combat/ships';
import { newGame } from '../../../src/sim/newGame';
import type { Sim } from '../../../src/sim/sim';
import { content } from '../content';
import { runSim } from '../run';
import { cachedWorld } from '../world';

export type Tile = { x: number; y: number };

/**
 * A started game with a trading station of `size` east of the player and 5000 credits. With the default content it is built once
 * per test file and cloned per call; custom content builds fresh.
 */
export function yardGame(size: 'outpost' | 'station' | 'hub' = 'station', kind = 'station.trading', c: typeof content = content): { sim: Sim; station: number; me: number } {
  const build = (): Sim => {
    const s = newGame(1, c);
    for (let i = 0; i < 5; i++) s.step();
    s.enqueue({ type: 'debug.spawnStation', kind, size, seed: 4 });
    s.step();
    s.trade.credits = 5000;
    return s;
  };
  const sim = c === content ? cachedWorld(`yard:${kind}:${size}`, build) : build();
  const station = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.immobile)!;
  return { sim, station, me: homeShip(sim) };
}

/** The border of a w x h rectangle at (x, y) in the player ship's own tiles: what the Hull plan tool puts down for a drag. */
export function outline(sim: Sim, me: number, x: number, y: number, w: number, h: number): Tile[] {
  return rect(sim, me, x, y, w, h).filter((t, i) => { const [cx, cy] = [i % w, Math.floor(i / w)]; return cx === 0 || cy === 0 || cx === w - 1 || cy === h - 1; });
}

/** Plan an outer hull for the player's ship (the command the build tool sends). */
export function planHull(sim: Sim, me: number, tiles: Tile[]): void {
  sim.enqueue({ type: 'hull.plan', ship: me, tiles });
  sim.step();
  sim.events.drain();
}

/** Painted tiles: a w x h rectangle at (x, y) in the player ship's own tiles (its top-left is 0, 0). */
export function rect(sim: Sim, me: number, x: number, y: number, w: number, h: number): Tile[] {
  const s = sim.world.get(me, ShipC)!;
  const out: Tile[] = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.push({ x: s.x + x + i, y: s.y + y + j });
  return out;
}

/** Run `n` ticks and return the rejection and yard event log (the shared `runSim` log, filtered: `rejected:<command>:<reason>`, `yard.*`). */
export function run(sim: Sim, n: number, until?: () => boolean): string[] {
  return runSim(sim, n, { until: until && (() => until()) }).log
    .filter((l) => l.startsWith('command.rejected:') || l.startsWith('yard.'))
    .map((l) => (l.startsWith('command.rejected:') ? `rejected:${l.slice('command.rejected:'.length)}` : l));
}
