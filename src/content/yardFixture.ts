import { ShipC, homeShip, newGame, type Sim, type SimEvent } from '../sim';
import { content } from './index';

export type Tile = { x: number; y: number };

/** A started game with a trading station of `size` east of the player and 5000 credits. */
export function yardGame(size: 'outpost' | 'station' | 'hub' = 'station', kind = 'station.trading', c: typeof content = content): { sim: Sim; station: number; me: number } {
  const sim = newGame(1, c);
  for (let i = 0; i < 5; i++) sim.step();
  sim.enqueue({ type: 'debug.spawnStation', kind, size, seed: 4 });
  sim.step();
  const station = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.immobile)!;
  sim.trade.credits = 5000;
  return { sim, station, me: homeShip(sim) };
}

/** Painted tiles: a w x h rectangle at (x, y) in the player ship's own tiles (its top-left is 0, 0). */
export function rect(sim: Sim, me: number, x: number, y: number, w: number, h: number): Tile[] {
  const s = sim.world.get(me, ShipC)!;
  const out: Tile[] = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.push({ x: s.x + x + i, y: s.y + y + j });
  return out;
}

/** Run `n` ticks and return the rejection and yard event log. */
export function run(sim: Sim, n: number, until?: () => boolean): string[] {
  const log: string[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    for (const e of sim.events.drain() as SimEvent[]) {
      if (e.type === 'command.rejected') log.push(`rejected:${e.command}:${e.reason}`);
      else if (e.type.startsWith('yard.')) log.push(e.type);
    }
    if (until?.()) break;
  }
  return log;
}
