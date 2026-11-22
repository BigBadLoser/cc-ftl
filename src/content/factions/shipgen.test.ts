import { describe, expect, it } from 'vitest';
import { isTileWalkable } from '../../sim/modules/walk';
import { newGame } from '../../sim/newGame';
import type { ModuleDef } from '../../sim/registry';
import { Rng } from '../../sim/rng';
import { generateShip } from '../../sim/shipgen/generate';
import { allRooms, planShip } from '../../sim/shipgen/plan';
import { adjacencyDistance, adjacencySignature, meanPairwise, silhouetteDistance, silhouetteMask } from '../../sim/shipgen/metrics';
import type { FactionDef, GenResult } from '../../sim/shipgen/types';
import { Struct } from '../../sim/structure';
import { content } from '../index';
import { factions } from './index';
import { shipGrid, shipIds } from '../../sim/regions';
import { homeShip } from '../../sim/combat/shipQuery';

const defs = content.modules as Record<string, ModuleDef>;
const gen = (id: keyof typeof factions, seed: number, depth: number): GenResult =>
  generateShip(factions[id] as FactionDef, id, seed, depth, defs);
const count = (g: GenResult, pred: (d: ModuleDef) => boolean): number =>
  (g.template.modules ?? []).filter((m) => defs[m.def] && pred(defs[m.def] as ModuleDef)).length;
/** The navy as the arranger builds it (its hull families' grammars), before the game drew navy hulls outline first (#581). */
const arrangerNavy: FactionDef = { ...(factions['faction.navy'] as FactionDef) };
delete arrangerNavy.outline;
const arranged = (seed: number, depth: number): GenResult => generateShip(arrangerNavy, 'faction.navy', seed, depth, defs);

describe('ship generator: doctrines', () => {
  it('navy in the game: every type appears, each drawn outline first and valid', () => {
    const types = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const g = gen('faction.navy', seed, seed % 2 === 1 ? 9 : seed % 10);
      types.add(g.role);
      expect(g.topology, `seed ${seed}`).toMatch(/^outline /);
      expect(g.problems, `seed ${seed}`).toEqual([]);
    }
    expect([...types].sort()).toEqual(['carrier', 'corvette', 'cruiser', 'destroyer', 'frigate']);
  });

  it('navy (2D arranger): every hull family appears, major assemblies sit side by side, architecture varies', () => {
    const families = new Set<string>();
    let sideBySide = 0;
    for (let seed = 0; seed < 60; seed++) {
      const g = arranged(seed, seed % 2 === 1 ? 9 : seed % 10);
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
    // 48 deep hulls: the spread of twelve swings from 0.18 to 0.35 with the window of seeds, so a wide fixed sample (0.263 silhouette, 0.532 adjacency).
    const deep = Array.from({ length: 48 }, (_, i) => arranged(i + 1, 9));
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
      expect(g.metrics!.corridorRatio).toBeLessThan(0.37);
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

  it('civilians (same arranger, civil builders): four families, lightly armed, never a battery', () => {
    const families = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const g = gen('faction.civilian', seed, seed % 10);
      families.add(g.role);
      expect(count(g, (m) => !!m.weapon && !m.pointDefense), `seed ${seed} guns`).toBeLessThanOrEqual(2);
      expect(count(g, (m) => !!m.bed)).toBeGreaterThan(0);
    }
    expect([...families].sort()).toEqual(['freighter', 'liner', 'mining', 'station']);
  });

  it('beam tiles load as solid, unwalkable, airtight Struct.Beam', () => {
    const seed = Array.from({ length: 30 }, (_, s) => s).find((s) => gen('faction.drones', s, 5).template.rows.some((r) => r.includes('=')))!;
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnGenerated', faction: 'faction.drones', seed, depth: 5, cx: 130, cy: 70 });
    sim.step();
    const grid = shipGrid(sim, shipIds(sim).find((i) => i !== homeShip(sim))!)!;
    let seen = 0;
    for (let y = grid.y0; y < grid.y0 + grid.height; y++) for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
      if (grid.get('struct', x, y) !== Struct.Beam) continue;
      seen++;
      expect(isTileWalkable(sim, grid, x, y)).toBe(false);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('an island carrier from the arranger keeps one bridge: its nose holds stores, not a second helm', () => {
    let seen = 0;
    for (const seed of [3, 13]) {
      const r = arranged(seed, 9);
      if (!r.topology.includes('carrierIsland')) continue;
      seen++;
      expect(r.problems).toEqual([]);
      expect((r.template.modules ?? []).filter((m) => m.def === 'module.helm').length).toBe(1);
    }
    expect(seen).toBeGreaterThan(0);
  });

});

describe('ship generator: engines booked ahead (#571)', () => {
  const navy = factions['faction.navy'] as FactionDef;
  const corvette = navy.hullFamilies!.find((h) => h.id === 'corvette')!;
  const role = { id: corvette.id, weight: corvette.weight, archetypes: [], ...(corvette.bonus ? { bonus: corvette.bonus } : {}) };
  const cap = defs['module.engine']!.engine!.hullCapacity!;

  it('a family estimate books the engines its rooms need; none books the budget alone', () => {
    const none = planShip(new Rng(7), navy, role, 1, defs);
    const booked = planShip(new Rng(7), navy, role, 1, defs, 0, corvette.hullPerRoomTile);
    const area = allRooms(booked).reduce((t, r) => t + r.w * r.h, 0);
    expect(booked.engines).toBeGreaterThan(none.engines);
    // The estimate's own hull fits on the engines it booked, and one fewer would not.
    expect(corvette.hullPerRoomTile! * (area + 20 * booked.engines)).toBeLessThanOrEqual(booked.engines * cap);
    expect(corvette.hullPerRoomTile! * (area + 20 * (booked.engines - 1))).toBeGreaterThan((booked.engines - 1) * cap);
  });
});
