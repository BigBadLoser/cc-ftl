import { describe, expect, it } from 'vitest';
import {
  ModuleC, ShipC, Struct, accessTile, deserialize, footprintTiles, generateShip, hullRow, isTileWalkable, newGame,
  meanPairwise, openTilesOf, profileDistance, serialize, silhouetteDistance, silhouetteMask, type FactionDef, type GenResult, type ModuleDef, type Sim,
} from '../../sim';
import { content } from '../index';
import { factions } from './index';

const defs = content.modules as Record<string, ModuleDef>;
const ids = Object.keys(factions) as (keyof typeof factions)[];
const gen = (id: keyof typeof factions, seed: number, depth: number): GenResult =>
  generateShip(factions[id] as FactionDef, id, seed, depth, defs);
const count = (g: GenResult, pred: (d: ModuleDef) => boolean): number =>
  (g.template.modules ?? []).filter((m) => defs[m.def] && pred(defs[m.def] as ModuleDef)).length;

/** Spawn a generated ship in a real sim and return the sim and its grid id. */
function spawned(faction: string, seed: number, depth: number): { sim: Sim; gridId: number } {
  const sim = newGame(1, content);
  sim.enqueue({ type: 'debug.spawnGenerated', faction, seed, depth, cx: 130, cy: 70 });
  sim.step();
  const ship = sim.world.query(ShipC).map((i) => sim.world.get(i, ShipC)!).find((s) => s.gridId !== 1);
  return { sim, gridId: ship?.gridId ?? 0 };
}

describe('ship generator', () => {
  it('is deterministic: same faction, seed and depth give the same template; seeds vary the layout', () => {
    for (const id of ids) {
      expect(gen(id, 77, 3).template).toEqual(gen(id, 77, 3).template);
      const layouts = new Set(Array.from({ length: 12 }, (_, s) => gen(id, s, 3).template.rows.join('\n')));
      expect(layouts.size, id).toBeGreaterThanOrEqual(6);
    }
  });

  for (const id of ids) {
    it(`${id}: 200 seeds across depths 0-9 all validate`, () => {
      const bad: string[] = [];
      for (let seed = 0; seed < 200; seed++) {
        const g = gen(id, seed * 7919 + 13, seed % 10);
        if (g.problems.length > 0) bad.push(`seed ${seed}: ${g.problems.join('; ')}`);
      }
      expect(bad).toEqual([]);
    });
  }

  it('scales with depth: deeper ships are longer, better armed and shielded, with more power and crew', () => {
    for (const id of ids) {
      const avg = (depth: number, f: (g: GenResult) => number): number => {
        let s = 0;
        for (let seed = 0; seed < 30; seed++) s += f(gen(id, seed, depth));
        return s / 30;
      };
      const stats = (g: GenResult) => [g.width, count(g, (d) => !!d.weapon), count(g, (d) => !!d.shieldGen), count(g, (d) => d.power > 0), g.template.crew?.length ?? 0];
      for (let k = 0; k < 5; k++) {
        const shallow = avg(0, (g) => stats(g)[k] as number);
        const deep = avg(9, (g) => stats(g)[k] as number);
        expect(deep, `${id} stat ${k}`).toBeGreaterThan(shallow);
      }
    }
  });

  it('keeps each motif recognisable', () => {
    for (let seed = 0; seed < 30; seed++) {
      const d = gen('faction.drones', seed, seed % 10);
      expect(count(d, (m) => !!m.bed || !!m.o2PerSec)).toBe(0);
      expect(count(d, (m) => !!m.aiCore)).toBe(1);
      const s = gen('faction.scrapper', seed, seed % 10);
      expect(count(s, (m) => !!m.vehicleBay)).toBe(1);
      expect(s.template.boarding).toBeDefined();
      expect(count(s, (m) => !!m.storage)).toBeGreaterThanOrEqual(5);
      const n = gen('faction.navy', seed, seed % 10);
      expect([...n.template.rows].reverse(), `${n.template.name} hull is mirror-symmetric`).toEqual(n.template.rows);
    }
    const lopsided = Array.from({ length: 20 }, (_, seed) => gen('faction.scrapper', seed, 4).template.rows)
      .filter((rows) => rows.join() !== [...rows].reverse().join());
    expect(lopsided.length).toBeGreaterThanOrEqual(18);
  });

  it('navy (assembly-driven): sections with matched bulkhead ports, every hull family appears, seeds vary at macro scale', () => {
    const families = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      const g = gen('faction.navy', seed, seed % 2 === 1 ? 9 : seed % 10);
      families.add(g.role);
      expect(g.debug, 'composer debug data').toBeDefined();
      expect(g.debug!.ports.every((p) => p.matched), `seed ${seed} ports`).toBe(true);
      expect(g.debug!.joins.some((j) => j.kind === 'frame')).toBe(true);
      expect(g.metrics!.compactness).toBeGreaterThan(0.38);
    }
    expect([...families].sort()).toEqual(['carrier', 'corvette', 'cruiser', 'frigate']);
    const deep = Array.from({ length: 12 }, (_, i) => gen('faction.navy', i + 1, 9));
    expect(meanPairwise(deep.map((g) => silhouetteMask(g.template.rows)), silhouetteDistance)).toBeGreaterThan(0.15);
    expect(meanPairwise(deep.map((g) => g.debug!.profile), profileDistance)).toBeGreaterThan(0.4);
  });

  for (const id of ids) {
    it(`${id}: spawned in the sim, modules sit on floor and hull, chairs and access tiles are open, all floor is reachable, power balances`, () => {
      for (let seed = 0; seed < 12; seed++) {
        const { sim, gridId } = spawned(id, seed * 31 + 5, seed % 10);
        expect(gridId, `seed ${seed} spawned`).toBeGreaterThan(1);
        const grid = sim.grids.get(gridId)!;
        let supply = 0;
        let demand = 0;
        for (const mid of sim.world.query(ModuleC)) {
          const m = sim.world.get(mid, ModuleC)!;
          if (m.gridId !== gridId) continue;
          const def = defs[m.def] as ModuleDef;
          const wall = hullRow(def, m.x, m.y, m.rot);
          if (!def.airlock) {
            for (const t of footprintTiles(def, m.x, m.y, m.rot)) {
              const onWall = wall.some((w) => w.x === t.x && w.y === t.y);
              expect(grid.get('struct', t.x, t.y), `${m.def} at ${t.x},${t.y}`).toBe(onWall ? Struct.Wall : Struct.Floor);
            }
          }
          const at = accessTile(def, m.x, m.y, m.rot);
          if (at) expect(isTileWalkable(sim, grid, at.x, at.y), `${m.def} access`).toBe(true);
          for (const t of openTilesOf(def, m.x, m.y, m.rot)) expect(isTileWalkable(sim, grid, t.x, t.y)).toBe(true);
          if (def.power > 0) supply += def.power; else demand -= def.power;
        }
        expect(demand).toBeLessThanOrEqual(supply);
        // Flood from the first door over walkable tiles: everything walkable is reached.
        const walk = (x: number, y: number) => grid.inBounds(x, y) && isTileWalkable(sim, grid, x, y);
        let start = -1;
        let total = 0;
        for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
          if (!walk(x, y)) continue;
          total++;
          if (start < 0 && grid.get('struct', x, y) === Struct.Door) start = y * grid.width + x;
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
    const { sim, gridId } = spawned('faction.navy', 1234, 5);
    const ship = sim.world.query(ShipC).map((i) => sim.world.get(i, ShipC)!).find((s) => s.gridId === gridId)!;
    expect(ship.gen).toEqual({ faction: 'faction.navy', seed: 1234, depth: 5 });
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
