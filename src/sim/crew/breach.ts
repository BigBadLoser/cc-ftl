import { structCostKey } from '../items/stacks';
import { totalStock } from '../items/stock';
import { regions } from '../regions';
import { ShipC } from '../combat/components';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import type { Tile } from './pathfind';

const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Open-space tiles (sector coordinates) touching the floor of a room on the grid: the holes in the hull. */
export function breachTiles(sim: Sim): { ship: number; tile: Tile }[] {
  const out: { ship: number; tile: Tile }[] = [];
  for (const { grid, ship } of regions(sim)) {
    if (!grid.has('room') || sim.world.get(ship, ShipC)?.faction !== 'player') continue;
    const seen = new Set<number>();
    for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
      for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
        if (grid.get('room', x, y) === 0) continue;
        for (const [dx, dy] of SIDES) {
          const nx = x + dx;
          const ny = y + dy;
          const key = ny * 100000 + nx;
          if (!grid.inBounds(nx, ny) || seen.has(key) || grid.get('struct', nx, ny) !== Struct.Space) continue;
          seen.add(key);
          out.push({ ship, tile: { x: nx, y: ny } });
        }
      }
    }
  }
  return out;
}

/** True when the ships' stock holds the materials of one wall (the seal job is only posted then, so it is not left waiting for metal). */
export function canAffordWall(sim: Sim): boolean {
  const key = structCostKey(Struct.Wall);
  return (key ? sim.content.structCosts[key] ?? [] : []).every((q) => totalStock(sim, q.item) >= q.count);
}
