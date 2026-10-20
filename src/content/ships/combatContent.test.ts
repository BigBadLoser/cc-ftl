import { describe, expect, it } from 'vitest';
import {
  ModuleC, Struct, footprintTiles, hullRow, isTileWalkable, newGame, openTilesOf, accessTile, findPath, type Sim,
} from '../../sim';
import { content } from '../index';
import { shipIdOf, shipGrid, shipIds } from '../../sim/regions';

function spawned(shipId: string): Sim {
  const sim = newGame(1, content);
  if (shipId !== 'ship.starter') sim.enqueue({ type: 'debug.spawnEnemy', template: shipId, x: 100, y: 50 });
  sim.step();
  return sim;
}

describe('combat content', () => {
  for (const template of ['ship.starter', 'ship.raider']) {
    it(`${template}: modules sit on floor (engines on the hull wall), chairs are open, everything walkable is reachable, power balances`, () => {
      const sim = spawned(template);
      const shipId = shipIds(sim)[template === 'ship.starter' ? 0 : 1] as number;
      const grid = shipGrid(sim, shipId)!;
      let supply = 0;
      let demand = 0;
      for (const id of sim.world.query(ModuleC)) {
        const m = sim.world.get(id, ModuleC)!;
        if (shipIdOf(sim, m) !== shipId) continue;
        const def = content.modules[m.def as keyof typeof content.modules] as import('../../sim').ModuleDef;
        const wall = hullRow(def, m.x, m.y, m.rot);
        for (const t of footprintTiles(def, m.x, m.y, m.rot)) {
          const onWall = wall.some((w) => w.x === t.x && w.y === t.y);
          if (def.airlock) continue; // airlock tiles become doors and chamber floor on spawn
          expect(grid.get('struct', t.x, t.y), `${m.def} at ${t.x},${t.y}`).toBe(onWall ? Struct.Wall : Struct.Floor);
        }
        const at = accessTile(def, m.x, m.y, m.rot);
        if (at) expect(isTileWalkable(sim, grid, at.x, at.y), `${m.def} access`).toBe(true);
        for (const t of openTilesOf(def, m.x, m.y, m.rot)) expect(isTileWalkable(sim, grid, t.x, t.y)).toBe(true);
        if (def.power > 0) supply += def.power;
        else demand -= def.power;
      }
      expect(demand).toBeLessThanOrEqual(supply);
    });

    it(`${template}: every walkable tile is reachable from the first door`, () => {
      const sim = spawned(template);
      const shipId = shipIds(sim)[template === 'ship.starter' ? 0 : 1] as number;
      const grid = shipGrid(sim, shipId)!;
      let start: { x: number; y: number } | null = null;
      for (let y = grid.y0; y < grid.y0 + grid.height && !start; y++) {
        for (let x = grid.x0; x < grid.x0 + grid.width && !start; x++) if (grid.get('struct', x, y) === Struct.Door) start = { x, y };
      }
      expect(start).not.toBeNull();
      const stuck: string[] = [];
      for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
        for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
          if (isTileWalkable(sim, grid, x, y) && !findPath(sim, shipId, start!, { x, y })) stuck.push(`${x},${y}`);
        }
      }
      expect(stuck).toEqual([]);
    });
  }
});
