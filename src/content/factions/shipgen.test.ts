import { describe, expect, it } from 'vitest';
import {
  ModuleC, ShipC, Struct, accessTile, deserialize, footprintTiles, generateShip, hullRow, isTileWalkable, newGame,
  adjacencyDistance, adjacencySignature, meanPairwise, openTilesOf, serialize, silhouetteDistance, silhouetteMask, type FactionDef, type GenResult, type ModuleDef, type Sim,
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
    }, 90000);
  }

  it('scales with depth: deeper ships are longer, better armed and shielded, with more power and crew', () => {
    for (const id of ids) {
      const stats = (g: GenResult) => [g.width, count(g, (d) => !!d.weapon), count(g, (d) => !!d.shieldGen), count(g, (d) => d.power > 0), g.template.crew?.length ?? 0];
      const avgs = (depth: number): number[] => {
        const s = [0, 0, 0, 0, 0];
        for (let seed = 0; seed < 30; seed++) stats(gen(id, seed, depth)).forEach((v, k) => { s[k]! += v / 30; });
        return s;
      };
      const [lo, hi] = [avgs(0), avgs(9)];
      for (let k = 0; k < 5; k++) {
        expect(hi[k], `${id} stat ${k}`).toBeGreaterThan(lo[k] as number);
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
      // Navy hulls are mirrored (doors aside), except the carrier's offset island; staggered gun mounts may break it,
      // so any mismatch must lie inside a mount (or its mirror image).
      const dbg = n.debug!;
      const mounts = dbg.assemblies.filter((a) => a.kind === 'mount' || a.kind === 'plate');
      const inMount = (x: number, y: number): boolean => mounts.some((a) => x >= a.x && x < a.x + a.w && y >= a.y && y < a.y + a.h);
      const rows = n.template.rows.map((r) => r.replace(/D/g, '#'));
      // Mirror about the root assembly's axis (asymmetric mounts shift the crop).
      const r0 = dbg.assemblies[0]!;
      const m = (y: number): number => 2 * r0.y + r0.h - 1 - y;
      const bad = rows.flatMap((r, y) => [...r].map((ch, x) => ((rows[m(y)]?.[x] ?? '.') !== ch && !inMount(x, y) && !inMount(x, m(y)) ? `${x},${y}` : '')).filter(Boolean));
      if (n.role !== 'carrier') expect(bad, `${n.template.name} hull is mirror-symmetric`).toEqual([]);
    }
    const lopsided = Array.from({ length: 20 }, (_, seed) => gen('faction.scrapper', seed, 4).template.rows)
      .filter((rows) => rows.join() !== [...rows].reverse().join());
    expect(lopsided.length).toBeGreaterThanOrEqual(18);
  });

  it('navy (2D arranger): every hull family appears, major assemblies sit side by side, architecture varies', () => {
    const families = new Set<string>();
    let sideBySide = 0;
    for (let seed = 0; seed < 60; seed++) {
      const g = gen('faction.navy', seed, seed % 2 === 1 ? 9 : seed % 10);
      families.add(g.role);
      const d = g.debug!;
      expect(d, 'arranger debug data').toBeDefined();
      expect(d.joins.length).toBeGreaterThanOrEqual(2);
      // A major assembly joined to another north or south of it (not a dock or a strut): side by side, not a chain.
      // Long decks reach far fore and aft of their host: stacked means the spans overlap lengthways, not beside.
      const major = (k: string): boolean => k !== 'dock' && k !== 'hall';
      if (d.joins.some((j) => {
        const a = d.assemblies[j.a]!;
        const b = d.assemblies[j.b]!;
        const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        return major(a.kind) && major(b.kind) && overlapX > 4 && overlapY < Math.min(a.h, b.h) / 2;
      })) sideBySide++;
    }
    expect([...families].sort()).toEqual(['carrier', 'corvette', 'cruiser', 'frigate']);
    expect(sideBySide).toBeGreaterThan(25);
    const deep = Array.from({ length: 12 }, (_, i) => gen('faction.navy', i + 1, 9));
    expect(meanPairwise(deep.map((g) => silhouetteMask(g.template.rows)), silhouetteDistance)).toBeGreaterThan(0.25);
    expect(meanPairwise(deep.map((g) => adjacencySignature(g.debug!)), adjacencyDistance)).toBeGreaterThan(0.45);
  });

  it('navy hulls have no enclosed courtyards (open at one end, or plated over)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const g = gen('faction.navy', seed, seed % 10);
      const w = g.width;
      const rows = g.template.rows.map((r) => r.padEnd(w, '.'));
      const seen = new Set<number>([0]);
      const st = [0];
      while (st.length > 0) {
        const i = st.pop() as number;
        const x = i % w;
        const y = Math.floor(i / w);
        for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
          if (a < 0 || b < 0 || a >= w || b >= g.height || rows[b]?.[a] !== '.' || seen.has(b * w + a)) continue;
          seen.add(b * w + a);
          st.push(b * w + a);
        }
      }
      const enclosed = rows.reduce((t, r, y) => t + [...r].filter((c, x) => c === '.' && !seen.has(y * w + x)).length, 0);
      expect(enclosed, `seed ${seed}`).toBe(0);
    }
  });

  it('drones (same arranger, machine doctrine): AI core as bridge, sealed pods, beams, robot crawlways only', () => {
    let beams = 0;
    for (let seed = 0; seed < 30; seed++) {
      const g = gen('faction.drones', seed, seed % 10);
      const d = g.debug!;
      expect(d, 'arranger debug data').toBeDefined();
      expect(count(g, (m) => !!m.bridge)).toBe(0);
      expect(count(g, (m) => !!m.aiCore)).toBe(1);
      expect(d.traversal.every((t) => t.access === 'robot' || t.access === 'human')).toBe(true);
      expect(d.assemblies.some((a) => a.access === 'external')).toBe(true);
      expect(g.metrics!.occupancy).toBeGreaterThan(0.6);
      expect(g.metrics!.corridorRatio).toBeLessThan(0.35);
      if (g.template.rows.some((r) => r.includes('='))) beams++;
    }
    expect(beams).toBeGreaterThan(20);
  });

  it('scrappers (same arranger, salvage doctrine): several donor hulls of two or more origins welded together, anchors vary', () => {
    const anchors = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const d = gen('faction.scrapper', seed, seed % 10).debug!;
      const donors = d.assemblies.filter((a) => a.donor && a.donor !== 'scrap');
      expect(new Set(donors.map((a) => a.label)).size, `seed ${seed} donor kinds`).toBeGreaterThanOrEqual(3);
      expect(new Set(donors.map((a) => a.donor)).size, `seed ${seed} origins`).toBeGreaterThanOrEqual(2);
      expect(d.joins.some((j) => j.kind === 'graft')).toBe(true);
      // Pieces are whole donors, not room-by-room corridor assemblies.
      expect(donors.length).toBeLessThanOrEqual(10);
      anchors.add(d.assemblies[0]!.label);
    }
    expect(anchors.size).toBeGreaterThanOrEqual(4);
  });

  it('beam tiles load as solid, unwalkable, airtight Struct.Beam', () => {
    const seed = Array.from({ length: 30 }, (_, s) => s).find((s) => gen('faction.drones', s, 5).template.rows.some((r) => r.includes('=')))!;
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnGenerated', faction: 'faction.drones', seed, depth: 5, cx: 130, cy: 70 });
    sim.step();
    const grid = [...sim.grids.values()].find((x) => x.id !== 1)!;
    let seen = 0;
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
      if (grid.get('struct', x, y) !== Struct.Beam) continue;
      seen++;
      expect(isTileWalkable(sim, grid, x, y)).toBe(false);
    }
    expect(seen).toBeGreaterThan(0);
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
