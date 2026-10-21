import { describe, expect, it } from 'vitest';
import { ModuleC, ShipC, Struct, accessTile, deserialize, footprintTiles, hullRow, isTileWalkable, newGame, openTilesOf, serialize, type ModuleDef, type Sim } from '../../sim';
import { content } from '../index';
import { factions } from './index';
import { shipIdOf, shipGrid, shipIds } from '../../sim/regions';
import { homeShip } from '../../sim/combat/ships';

const defs = content.modules as Record<string, ModuleDef>;
const ids = Object.keys(factions) as (keyof typeof factions)[];

/** Spawn a generated ship in a real sim and return the sim and its grid id. */
function spawned(faction: string, seed: number, depth: number): { sim: Sim; shipId: number } {
  const sim = newGame(1, content);
  sim.enqueue({ type: 'debug.spawnGenerated', faction, seed, depth, cx: 130, cy: 70 });
  sim.step();
  return { sim, shipId: shipIds(sim).find((i) => i !== homeShip(sim)) ?? 0 };
}

describe('ship generator: spawned in the sim', () => {
  for (const id of ids) {
    it(`${id}: spawned in the sim, modules sit on floor and hull, chairs and access tiles are open, all floor is reachable, power balances`, () => {
      for (let seed = 0; seed < 12; seed++) {
        const { sim, shipId } = spawned(id, seed * 31 + 5, seed % 10);
        expect(shipId, `seed ${seed} spawned`).toBeGreaterThan(1);
        const grid = shipGrid(sim, shipId)!;
        let supply = 0;
        let demand = 0;
        for (const mid of sim.world.query(ModuleC)) {
          const m = sim.world.get(mid, ModuleC)!;
          if (shipIdOf(sim, m) !== shipId) continue;
          const def = defs[m.def] as ModuleDef;
          const wall = hullRow(def, m.x, m.y, m.rot);
          if (!def.airlock) {
            for (const t of footprintTiles(def, m.x, m.y, m.rot)) {
              const onWall = wall.some((w) => w.x === t.x && w.y === t.y);
              // Containers stand on their frame's Beam tiles, sealed (no floor).
              expect(grid.get('struct', t.x, t.y), `${m.def} at ${t.x},${t.y}`).toBe(def.container ? Struct.Beam : onWall ? Struct.Wall : Struct.Floor);
            }
          }
          const at = accessTile(def, m.x, m.y, m.rot);
          if (at) expect(isTileWalkable(sim, grid, at.x, at.y), `${m.def} access`).toBe(true);
          for (const t of openTilesOf(def, m.x, m.y, m.rot)) expect(isTileWalkable(sim, grid, t.x, t.y)).toBe(true);
          if (def.power > 0) supply += def.power; else demand -= def.power;
        }
        expect(demand).toBeLessThanOrEqual(supply);
        // Flood from the first door over walkable tiles: everything walkable is reached.
        // Local tiles (lx, ly) from the grid's top-left; the grid reads sector tiles.
        const walk = (x: number, y: number) => grid.inBounds(grid.x0 + x, grid.y0 + y) && isTileWalkable(sim, grid, grid.x0 + x, grid.y0 + y);
        let start = -1;
        let total = 0;
        for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
          if (!walk(x, y)) continue;
          total++;
          if (start < 0 && grid.get('struct', grid.x0 + x, grid.y0 + y) === Struct.Door) start = y * grid.width + x;
        }
        const seen = new Set([start]);
        const stack = [start];
        while (stack.length) {
          const i = stack.pop()!;
          const x = i % grid.width;
          const y = Math.floor(i / grid.width);
          for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
            const j = ny * grid.width + nx;
            if (walk(nx, ny) && !seen.has(j)) { seen.add(j); stack.push(j); }
          }
        }
        expect(seen.size, `seed ${seed}`).toBe(total);
      }
    });
  }

  it('debug.spawnGenerated stores the origin on the ship, survives a save, and rejects unknown factions', () => {
    const { sim, shipId } = spawned('faction.navy', 1234, 5);
    const ship = sim.world.get(shipId, ShipC)!;
    expect(ship.gen).toMatchObject({ faction: 'faction.navy', seed: 1234, depth: 5 });
    expect(typeof ship.gen?.role).toBe('string');
    expect(ship.faction).toBe('hostile');
    const loaded = deserialize(serialize(sim), content);
    expect(serialize(loaded)).toBe(serialize(sim));
    sim.events.drain();
    sim.enqueue({ type: 'debug.spawnGenerated', faction: 'faction.nobody', depth: 0, cx: 30, cy: 30 });
    sim.step();
    expect(sim.events.drain().some((e) => e.type === 'command.rejected')).toBe(true);
  });

  it('a generated ship fights: a minute of combat against the starter runs without errors', () => {
    const { sim } = spawned('faction.scrapper', 99, 3);
    for (let t = 0; t < 20 * 60; t++) sim.step();
    expect(sim.world.query(ShipC).length).toBe(2);
  });
});
