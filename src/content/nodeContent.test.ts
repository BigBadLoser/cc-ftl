import { describe, expect, it } from 'vitest';
import { generateAsteroid } from '../sim/asteroids/gen';
import { galaxy } from './galaxy';
import { ores } from './ores';
import type { NodeContentTable } from '../sim/galaxy/defs';
import { curveAt, entryWeight, nodeContentErrors, fieldItems, oreMixFor, quietShare, rollNodeContent } from '../sim/galaxy/nodeContent';
import { buildSector } from '../sim/galaxy/sector';
import { dangerAt, TerritoryField } from '../sim/galaxy/territory';
import { DANGER_MAX } from '../sim/galaxy/tuning';

const table: NodeContentTable = galaxy.nodeContents;
const FIELD_KINDS = ['asteroids', 'asteroids_ice', 'asteroids_crystal', 'asteroids_rare'];
/** Sum of the table's weights at a tier (quiet plus every entry). */
const tableTotal = (tier: number) => curveAt(table.quiet, tier) + Object.values(table.entries).reduce((n, e) => n + entryWeight(e, tier), 0);
const calm = { factionKind: null, start: false };

/** Share of N evenly spread draws that land on each outcome at a tier. */
function shares(t: NodeContentTable, tier: number, kind: string | null = null, start = false, n = 20000) {
  const out: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const id = rollNodeContent(t, { tier, factionKind: kind, start }, (i + 0.5) / n) ?? 'quiet';
    out[id] = (out[id] ?? 0) + 1 / n;
  }
  return out;
}

describe('node content table', () => {
  it('is valid: known structures, sane curves and ranges, faction kinds that exist', () => {
    expect(nodeContentErrors(table, galaxy)).toEqual([]);
  });

  it('reports a broken entry', () => {
    const bad = {
      quiet: { base: 0.5 },
      entries: { x: { structure: 'structure.nope', danger: { min: 5, max: 2 }, weight: { base: 0 }, owner: 'none', notIn: ['nobody'] } },
    } as unknown as NodeContentTable;
    expect(nodeContentErrors(bad, galaxy).length).toBeGreaterThanOrEqual(4);
  });

  it("keeps today's per-kind odds at every tier", () => {
    for (let t = 0; t <= DANGER_MAX; t++) {
      const s = shares(table, t);
      expect(FIELD_KINDS.reduce((n, k) => n + (s[k] ?? 0), 0)).toBeCloseTo(0.3 + (t >= 3 ? 0.006 * t : 0), 2);
      expect(s['derelict'] ?? 0).toBeCloseTo(0.05 + 0.012 * t, 2);
      expect(s['research'] ?? 0).toBeCloseTo(0.1 - 0.01 * t, 2);
    }
  });

  it('leaves a quiet share by tier, matching the sampled draws', () => {
    for (let t = 0; t <= DANGER_MAX; t++) {
      const q = quietShare(table, { tier: t, ...calm });
      expect(q).toBeGreaterThan(0.45);
      expect(q).toBeLessThan(0.6);
      expect(shares(table, t)['quiet'] ?? 0).toBeCloseTo(q, 2);
    }
  });

  it('gates entries by danger tier', () => {
    const t: NodeContentTable = {
      quiet: { base: 0.5 },
      entries: { mid: { structure: 'structure.derelict', danger: { min: 2, max: 4 }, weight: { base: 0.5 }, owner: 'none' } },
    };
    for (let tier = 0; tier <= DANGER_MAX; tier++) {
      const s = shares(t, tier, null, false, 1000)['mid'] ?? 0;
      if (tier >= 2 && tier <= 4) expect(s).toBeCloseTo(0.5, 1);
      else expect(s).toBe(0);
    }
  });

  it("turns a barred entry into a quiet node and leaves the others' odds alone", () => {
    for (const kind of ['pirates', 'rogue']) {
      const s = shares(table, 3, kind);
      expect(s['research']).toBeUndefined();
      expect(FIELD_KINDS.reduce((n, k) => n + (s[k] ?? 0), 0)).toBeCloseTo(0.318, 2);
      expect(s['derelict']).toBeCloseTo(0.05 + 0.036, 2);
      expect(quietShare(table, { tier: 3, factionKind: kind, start: false })).toBeGreaterThan(quietShare(table, { tier: 3, ...calm }));
    }
    expect(shares(table, 3, 'government')['research']).toBeGreaterThan(0);
  });

  it("places research exactly where the old per-node roll did (u < 0.10 - 0.01 x tier), so stations and the fleets built on them did not move", () => {
    for (let t = 0; t <= DANGER_MAX; t++) {
      for (let i = 0; i < 2000; i++) {
        const u = (i + 0.5) / 2000;
        const got = rollNodeContent(table, { tier: t, ...calm }, u) === 'research';
        // The weights sum to 1 from tier 3 (rare ore's share comes out of `quiet`) and a hair under 1 at tiers 1 and 2, which scales the boundary.
        const edge = (0.1 - 0.01 * t) / tableTotal(t);
        if (Math.abs(u - edge) > 1e-9) expect(got).toBe(u < edge);
      }
    }
  });

  it('keeps derelicts off the start node', () => {
    expect(shares(table, 0, null, true)['derelict']).toBeUndefined();
    expect(shares(table, 0, null, false)['derelict']).toBeGreaterThan(0);
  });

  it('never goes below a weight of 0', () => {
    expect(curveAt({ base: 0.1, perTier: -0.05 }, 9)).toBe(0);
  });
});

describe('node content in generated sectors', () => {
  const sectors = (seed: number) => {
    const territory = new TerritoryField(seed, galaxy.factions);
    const ctx = { seed, content: galaxy, territory, chunkOf: () => 'c' };
    const out = [];
    for (let gx = -6; gx <= 6; gx++) for (let gy = -6; gy <= 6; gy++) {
      out.push(buildSector(ctx, { id: `s.${gx}.${gy}`, gx, gy, x: gx * 300 + 17, y: gy * 300 + 5, r: 150, density: 1 }));
    }
    return out;
  };

  it('is deterministic by seed and differs between seeds', () => {
    const sig = (seed: number) => JSON.stringify(sectors(seed).map((b) => b.nodes.map((n) => n.structures)));
    expect(sig(7)).toBe(sig(7));
    expect(sig(7)).not.toBe(sig(8));
  });

  it("puts at most one of the table's rocks and wrecks on a node, never research in pirate or rogue space, never a derelict on the start node", () => {
    const placed = new Set(Object.values(table.entries).map((e) => e.structure));
    for (const seed of [1, 2, 3]) {
      for (const b of sectors(seed)) {
        for (const n of b.nodes) {
          const kinds = n.structures.filter((s) => placed.has(s.def));
          // A faction's own station may be a research one too, so only the table's non-station kinds are exclusive.
          expect(kinds.filter((s) => s.def !== 'structure.station_research').length).toBeLessThanOrEqual(1);
          const fk = n.faction ? (galaxy.factions as Record<string, { kind: string }>)[n.faction]?.kind : null;
          if (fk === 'pirates' || fk === 'rogue') expect(kinds.some((s) => s.def === 'structure.station_research')).toBe(false);
          if (n.id === 's.0.0.n0') expect(kinds.some((s) => s.def === 'structure.derelict')).toBe(false);
        }
      }
    }
  });

  it("leaves a quiet share of nodes close to the table's, tier by tier", () => {
    const placed = new Set(Object.values(table.entries).map((e) => e.structure));
    const count = new Map<number, [number, number]>();
    for (const seed of [1, 2, 3, 4]) for (const b of sectors(seed)) for (const n of b.nodes) {
      const tier = dangerAt(n.x, n.y);
      const c = count.get(tier) ?? [0, 0];
      c[0]++;
      if (!n.structures.some((s) => placed.has(s.def))) c[1]++;
      count.set(tier, c);
    }
    expect(count.size).toBeGreaterThan(2);
    for (const [tier, [all, quiet]] of count) {
      if (all < 300) continue;
      // Barred research in hostile space only adds quiet, so the table's own share is the floor and the measured one stays near it.
      expect(Math.abs(quiet / all - quietShare(table, { tier, ...calm }))).toBeLessThan(0.08);
    }
  });
});

describe('asteroid field kinds', () => {
  it('has rocky, ice-rich, crystal and rare-ore kinds with a valid table and real ores', () => {
    for (const id of FIELD_KINDS) expect((galaxy.structures as Record<string, { kind: string }>)[table.entries[id]!.structure]?.kind).toBe('asteroids');
    expect(nodeContentErrors(table, galaxy, Object.keys(ores))).toEqual([]);
  });

  it('keeps the asteroid share at 0.30 and lets rare ore add to it from tier 3 (its weight comes out of quiet)', () => {
    for (let t = 0; t <= DANGER_MAX; t++) {
      const s = shares(table, t);
      const sum = FIELD_KINDS.reduce((n, k) => n + (s[k] ?? 0), 0);
      expect(sum).toBeCloseTo(0.3 + (t >= 3 ? 0.006 * t : 0), 2);
      expect(tableTotal(t)).toBeGreaterThan(0.98);
      expect(tableTotal(t)).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('gates rare-ore veins to deeper tiers and leaves rocky the common default', () => {
    for (let t = 0; t <= DANGER_MAX; t++) {
      const s = shares(table, t);
      if (t < 3) expect(s['asteroids_rare']).toBeUndefined();
      else expect(s['asteroids_rare']).toBeGreaterThan(0);
      expect(s['asteroids']!).toBeGreaterThan(s['asteroids_ice']!);
      expect(s['asteroids_ice']!).toBeGreaterThan(s['asteroids_crystal']!);
    }
  });

  it("each kind's mix leads with its own ore, and the ice, crystal and rare ores are existing items", () => {
    const lead = (id: string) => Object.entries(table.entries[id]!.ores!).sort((a, b) => b[1] - a[1])[0]![0];
    expect(lead('asteroids')).toBe('ore.iron');
    expect(table.entries['asteroids']!.ores!['ore.crystal']).toBe(1); // small crystal patches in rocky fields
    expect(table.entries['asteroids_crystal']!.ores!['ore.crystal']!).toBeGreaterThan(table.entries['asteroids']!.ores!['ore.crystal']! * 5);
    expect(lead('asteroids_ice')).toBe('ore.ice');
    expect(lead('asteroids_crystal')).toBe('ore.crystal');
    expect(lead('asteroids_rare')).toBe('ore.rare');
    expect(ores['ore.rare'].item).toBe('item.rare_ore');
  });
});

describe('field yield mix', () => {
  it('oreMixFor returns the entry mix, and nothing for a structure without one', () => {
    const mix = oreMixFor(table, ores, 'structure.asteroids_crystal')!;
    expect(mix.map((o) => o.item).sort()).toEqual(['item.energy_crystal', 'item.ice', 'item.iron_ore']);
    expect(mix.find((o) => o.item === 'item.energy_crystal')!.weight).toBe(7);
    expect(oreMixFor(table, ores, 'structure.derelict')).toBeUndefined();
    expect(fieldItems(table, ores, 'structure.asteroids_ice')).toEqual(['item.ice', 'item.iron_ore']);
    expect(fieldItems(table, ores, 'structure.derelict')).toEqual([]);
    expect(oreMixFor(table, ores, undefined)).toBeUndefined();
  });

  it('generated fields only carry the ores of their kind, and lead with the kind ore', () => {
    for (const [structure, lead] of [['structure.asteroids_ice', 'ore.ice'], ['structure.asteroids_crystal', 'ore.crystal'], ['structure.asteroids_rare', 'ore.rare']] as const) {
      const mix = oreMixFor(table, ores, structure)!;
      const allowed = new Set(mix.map((o) => o.code));
      const count = new Map<number, number>();
      for (let seed = 1; seed <= 60; seed++) {
        for (const c of generateAsteroid('field', seed, mix).ore) if (c) count.set(c, (count.get(c) ?? 0) + 1);
      }
      expect([...count.keys()].every((c) => allowed.has(c))).toBe(true);
      const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0]![0];
      expect(top).toBe(ores[lead].code);
    }
  });
});
