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
    for (const [type, seed, depth] of [['liner', 1, 3], ['liner', 2, 5], ['freighter', 1, 1], ['freighter', 2, 6], ['mining', 1, 1], ['mining', 2, 3], ['mining', 3, 6]] as const) {
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

  it('a lean miner (depth 1) has pods, ore bins and a galley, no guns and no crates', () => {
    const r = gen('mining', 1, 1);
    expect(r.problems).toEqual([]);
    const bays = (r.template.modules ?? []).filter((m) => m.vehicle === 'vehicle.mining_pod');
    expect(bays.length).toBeGreaterThanOrEqual(2);
    expect(mods(r, 'module.storage_ore').length).toBeGreaterThan(0);
    expect(mods(r, 'module.galley').length).toBeGreaterThan(0);
    expect((r.template.modules ?? []).filter((m) => defs[m.def]?.weapon).length).toBe(0);
    expect((r.template.modules ?? []).filter((m) => m.def === 'module.storage').length).toBe(0);
  });

  it('a deep miner (depth 6) refines ore in a hall, caps its pods and is wider', () => {
    const lean = gen('mining', 1, 1), deep = gen('mining', 1, 6);
    expect(deep.problems).toEqual([]);
    expect(gen('mining', 2, 3).problems).toEqual([]);
    expect(mods(deep, 'module.refinery').length).toBe(2);
    expect((deep.template.modules ?? []).filter((m) => m.vehicle === 'vehicle.mining_pod').length).toBeLessThanOrEqual(4);
    expect(deep.height).toBeGreaterThan(lean.height);
  });

  it('a depth-9 liner has twin drums, shields and point defence, and stays under 200 long', () => {
    const r = gen('liner', 1, 9);
    expect(r.problems).toEqual([]);
    const w = r.width, planters = mods(r, 'module.planter');
    const gardens = r.rooms.filter((room) => room.role === 'support' && planters.some((m) => room.tiles.includes(m.y * w + m.x)));
    expect(gardens.length).toBeGreaterThanOrEqual(2);
    expect(mods(r, 'module.shieldGen').length).toBeGreaterThan(0);
    expect(mods(r, 'module.pointDefense').length).toBeGreaterThan(0);
    expect(Math.max(r.width, r.height)).toBeLessThan(200);
  });
});
