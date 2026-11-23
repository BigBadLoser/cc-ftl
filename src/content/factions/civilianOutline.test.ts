import { describe, expect, it } from 'vitest';
import { content } from '../index';
import { rotatedSize } from '../../sim/modules/footprint';
import { generateOutline } from '../../sim/shipgen/assembly/outlineShip';
import type { ModuleDef } from '../../sim/registry';
import type { FactionDef, GenResult } from '../../sim/shipgen/types';

/** Civilian outline ships (#581): the liner and the pusher freighter. */

const defs = content.modules as unknown as Record<string, ModuleDef>;
const gen = (type: string, seed: number, depth: number): GenResult =>
  generateOutline((content.factions as unknown as Record<string, FactionDef>)['faction.civilian'] as FactionDef, 'faction.civilian', seed, depth, content.modules, type);
const mods = (r: GenResult, pre: string): { def: string; x: number; y: number; rot: number }[] =>
  (r.template.modules ?? []).filter((m) => m.def.startsWith(pre));

describe('civilian outline ships', () => {
  it('build valid, with an AI core only where they carry point defence or drones', () => {
    for (const [type, seed, depth] of [['liner', 1, 3], ['liner', 2, 5], ['freighter', 1, 1], ['freighter', 2, 6]] as const) {
      const r = gen(type, seed, depth);
      expect(r.problems, `${type} ${seed}`).toEqual([]);
      const armed = mods(r, 'module.pointDefense').length + mods(r, 'module.droneBay').length > 0;
      expect(mods(r, 'module.aiCore').length > 0, `${type} ${seed}`).toBe(armed);
    }
  });

  it('a freighter pushes more containers the deeper it is, in columns both sides share', () => {
    const shallow = mods(gen('freighter', 3, 1), 'container.'), deep = gen('freighter', 3, 6), boxes = mods(deep, 'container.');
    expect(boxes.length).toBeGreaterThan(shallow.length);
    const axis = deep.height / 2, xs = (above: boolean): Set<number> => new Set(boxes.filter((m) => m.y < axis === above).map((m) => m.x));
    const [a, b] = [xs(true), xs(false)], [less, more] = a.size <= b.size ? [a, b] : [b, a];
    // The side the pod stands on holds the fewer; every one of its columns is the other side's too.
    expect([...less].every((x) => more.has(x))).toBe(true);
  });

  it("a freighter's engines mirror across its axis", () => {
    for (const seed of [1, 2, 3, 4]) {
      const r = gen('freighter', seed, 3), eng = mods(r, 'module.engine');
      const span = (m: (typeof eng)[number]): [number, number] => [m.y, m.y + (rotatedSize(defs[m.def] as ModuleDef, m.rot)[1] ?? 1) - 1];
      const sum = Math.min(...eng.map((m) => span(m)[0])) + Math.max(...eng.map((m) => span(m)[1]));
      for (const m of eng) expect(eng.some((o) => o.def === m.def && o.x === m.x && o.y === sum - span(m)[1]), `seed ${seed} ${m.def}@${m.x},${m.y}`).toBe(true);
    }
  });
});
