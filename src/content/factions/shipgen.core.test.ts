import { describe, expect, it } from 'vitest';
import { generateShip, structureParts, type FactionDef, type GenResult, type ModuleDef } from '../../sim';
import { content } from '../index';
import { factions } from './index';

const defs = content.modules as Record<string, ModuleDef>;
const ids = Object.keys(factions) as (keyof typeof factions)[];
const gen = (id: keyof typeof factions, seed: number, depth: number): GenResult =>
  generateShip(factions[id] as FactionDef, id, seed, depth, defs);
const count = (g: GenResult, pred: (d: ModuleDef) => boolean): number =>
  (g.template.modules ?? []).filter((m) => defs[m.def] && pred(defs[m.def] as ModuleDef)).length;

describe('ship generator', () => {
  it('every ship is one connected structure (hull, walls, floors, beams 4-connected), first attempt mostly', () => {
    for (const id of ids) {
      let reseeded = 0;
      for (const depth of [1, 4, 9]) {
        for (let seed = 1; seed <= 12; seed++) {
          const g = gen(id, seed, depth);
          const w = Math.max(...g.template.rows.map((r) => r.length));
          const cells = g.template.rows.flatMap((r) => Array.from({ length: w }, (_, x) => r[x] ?? '.'));
          expect(structureParts(cells, w, g.template.rows.length), `${id} seed ${seed} depth ${depth}`).toBe(1);
          if (g.failures.some((f) => f.includes('disconnected'))) reseeded++;
        }
      }
      // Gaps are fixed at the source, not by reseeding.
      expect(reseeded, `${id} reseeds for disconnection`).toBeLessThanOrEqual(1);
    }
  }, 240000);

  it('is deterministic: same faction, seed and depth give the same template; seeds vary the layout', () => {
    for (const id of ids) {
      expect(gen(id, 77, 3).template).toEqual(gen(id, 77, 3).template);
      const layouts = new Set(Array.from({ length: 12 }, (_, s) => gen(id, s, 3).template.rows.join('\n')));
      expect(layouts.size, id).toBeGreaterThanOrEqual(6);
    }
  }, 90000);

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

});
