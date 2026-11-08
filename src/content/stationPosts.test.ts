import { describe, expect, it } from 'vitest';
import { ShipC, newGame, shipGrid } from '../sim';
import { isTileWalkable } from '../sim/modules/walk';
import { StationC } from '../sim/stations/components';
import { content } from './index';

/**
 * #107: a station's patrol stops are tiles guards stand on, so none may lie under a solid module (a room's centre can be a
 * mess table). Seed 7's first post was, so a guard could never reach it, and an intruder put there (the stationLife test) never arrived.
 */
describe('station patrol posts', () => {
  for (const size of ['outpost', 'station'] as const) {
    it(`are walkable on every ${size}, seeds 1 to 8`, () => {
      const bad: string[] = [];
      for (let seed = 1; seed <= 8; seed++) {
        const sim = newGame(3, content);
        sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size, seed });
        sim.step();
        const st = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)!.immobile)!;
        const grid = shipGrid(sim, st)!;
        const s = sim.world.get(st, StationC)!;
        expect(s.posts.length).toBeGreaterThan(0);
        for (const [kind, tiles] of [['post', s.posts]] as const) {
          for (const t of tiles) if (!isTileWalkable(sim, grid, t.x, t.y)) bad.push(`seed ${seed} ${kind} ${t.x},${t.y}`);
        }
      }
      expect(bad).toEqual([]);
    });
  }
});
