import type { World } from '../sim/ecs';
import { describe, expect, it } from 'vitest';
import type { Module } from '../sim/modules/components';
import { content } from '../content';
import { mergeRuinChain, ANIM_FPS, DAMAGED_BELOW, FLICKER_DARK_MS, FLICKER_LIT_MS, stateArt, animFrame, diagonalFront, frameCount, layerKey, moduleAssets, moduleLayers } from './moduleArt';
import { depthKey } from './iso';

const engine = content.modules['module.engine'];
const m = { def: 'module.engine', x: 24, y: 2, rot: 1 } as unknown as Module;

describe('module layer depth', () => {
  it('sorts a roofed engine under the roof plates of its footprint, an unroofed one at its front tile', () => {
    const layers = moduleLayers(null as never, 1, m, engine, false);
    // Unroofed: the module's own key (front tile) plus the layer order.
    expect(layerKey(engine, m, layers[0]!, 0, false, 31)).toBe(31);
    // Roofed: both the bulkhead and the machine sort just under the plate of the rear-most tile (24, 2), at +0.9.
    const hull = layerKey(engine, m, layers[0]!, 0, true, 31);
    const machine = layerKey(engine, m, layers[1]!, 1, true, 31);
    expect(hull).toBeCloseTo(26.85);
    expect(machine).toBeGreaterThan(hull);
    expect(machine).toBeLessThan(26.9);
  });
  it('sorts the bell by the tile beyond the hull row, roofed or not, so it draws over the hull behind it', () => {
    const layers = moduleLayers(null as never, 1, m, engine, true, true);
    expect(layers.map((l) => l.chain[0])).toEqual(['module.engine.hull.r1', 'module.engine.machine.open.r1.active', 'module.engine.bell.r1.active']);
    expect(layerKey(engine, m, layers[2]!, 2, false, 31)).toBe(34.5);
    expect(layerKey(engine, m, layers[2]!, 2, true, 31)).toBe(34.5);
  });
});

describe('container depth against walls', () => {
  const box = content.modules['container.3x6'];
  const mb = { def: 'container.3x6', x: 10, y: 0, rot: 0, hp: 190 } as unknown as Module;
  const world = { get: () => ({ clamp: 'n' }) } as never;
  it('cuts every container layer into diagonal strips', () => {
    const layers = moduleLayers(world, 7, mb, box!, false, true, { seed: 1 });
    expect(layers.filter((l) => !l.at).every((l) => l.strips)).toBe(true);
    expect(layers.length).toBeGreaterThan(2);
  });
  it('sorts each strip by the front-most footprint tile of its diagonal, so a wall east of the box draws over it', () => {
    // Footprint x 10..12, y 0..5: the old single key was its front tile (12, 5) = 17; a wall at (13, 1) (key 14) lost to it.
    expect(depthKey(12, 5)).toBe(17);
    const wall = depthKey(13, 1);
    const east = diagonalFront(10, 0, 3, 6, 12); // the strip right under that wall
    expect(east).toEqual({ x: 12, y: 0 });
    expect(depthKey(east.x, east.y)).toBeLessThan(wall);
    expect(diagonalFront(10, 0, 3, 6, 5)).toEqual({ x: 10, y: 5 });
    // Every strip's front tile lies inside the footprint.
    for (let d = 5; d <= 12; d++) {
      const f = diagonalFront(10, 0, 3, 6, d);
      expect(f.x).toBeGreaterThanOrEqual(10);
      expect(f.x).toBeLessThanOrEqual(12);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeLessThanOrEqual(5);
      expect(f.x - f.y).toBe(d);
    }
  });
});

describe('module state art', () => {
  const refinery = content.modules['module.refinery']!;
  const mr = { def: 'module.refinery', x: 4, y: 4, rot: 2 } as unknown as Module;
  const ids = new Set(['module.refinery.r2', 'module.refinery.r2.unpowered', 'module.refinery.r2.active', ...[1, 2, 3].map((f) => `module.refinery.r2.active.f${f}`)]);
  const has = (id: string) => ids.has(id);
  const look = (now: number, off = false) => ({ off, now, has });

  it('counts consecutive frames of a state', () => {
    expect(frameCount(has, 'module.refinery.r2.active')).toBe(4);
    expect(frameCount(has, 'module.refinery.r0.active')).toBe(1);
  });
  it('advances the frame at the animation rate and loops', () => {
    const ms = 1000 / ANIM_FPS;
    expect([0, 1, 2, 3, 4, 5].map((i) => animFrame(i * ms + 1, 4))).toEqual([0, 1, 2, 3, 0, 1]);
  });
  it('cycles the active frames while crafting, first the frame, then the plain chain', () => {
    const at = (now: number) => moduleAssets(null as never, 1, mr, refinery, true, look(now));
    expect(at(10)[0]).toBe('module.refinery.r2.active');
    expect(at(300)[0]).toBe('module.refinery.r2.active.f1');
    expect(at(800)[0]).toBe('module.refinery.r2.active.f3');
    expect(at(10).slice(1)).toEqual(moduleAssets(null as never, 1, mr, refinery, true));
  });
  it('uses the unpowered art while off, and plain idle otherwise', () => {
    expect(moduleAssets(null as never, 1, mr, refinery, false, look(0, true))[0]).toBe('module.refinery.r2.unpowered');
    expect(moduleAssets(null as never, 1, mr, refinery, false, look(0))[0]).toBe('module.refinery.r2');
  });
  it('leaves art without those variants alone and marks only animated layers', () => {
    const none = { ...look(500, true), has: () => false };
    expect(moduleAssets(null as never, 1, mr, refinery, true, none)).toEqual(moduleAssets(null as never, 1, mr, refinery, true));
    expect(moduleLayers(null as never, 1, mr, refinery, true, true, null, look(500))[0]!.anim).toBe('module.refinery.r2.active');
    expect(moduleLayers(null as never, 1, mr, refinery, false, true, null, look(500))[0]!.anim).toBeUndefined();
  });
});

describe('ore bin art', () => {
  const bin = content.modules['module.storage_ore']!;
  const m = { def: 'module.storage_ore', x: 4, y: 4, rot: 1 } as unknown as Module;
  const hold = (stacks: { item: string; count: number }[]): World =>
    ({ get: (_id: number, c: { name: string }) => (c.name === 'storage' ? { stacks, capacity: 24 } : undefined) }) as unknown as World;
  const head = (stacks: { item: string; count: number }[]) => moduleAssets(hold(stacks), 1, m, bin, false)[0];
  const slots = (item: string, n: number) => Array.from({ length: n }, () => ({ item, count: 10 }));

  it('shows the empty bin', () => {
    expect(head([])).toBe('module.storage_ore.r1.empty');
  });
  it('picks the dominant ore and the fill from the slots in use', () => {
    expect(head(slots('item.iron_ore', 3))).toBe('module.storage_ore.r1.iron.fill1');
    expect(head(slots('item.ice', 12))).toBe('module.storage_ore.r1.ice.fill2');
    expect(head(slots('item.rare_ore', 20))).toBe('module.storage_ore.r1.rare.full');
    expect(head([{ item: 'item.iron_ore', count: 90 }, { item: 'item.rare_ore', count: 4 }, { item: 'item.rare_ore', count: 4 }])).toBe('module.storage_ore.r1.rare.fill1');
  });
  it('ignores items with no ore art and falls back to the plain asset', () => {
    expect(head([{ item: 'item.metal', count: 5 }, { item: 'item.ice', count: 1 }])).toBe('module.storage_ore.r1.ice.fill1');
    expect(moduleAssets(hold(slots('item.metal', 3)), 1, m, bin, false).at(-1)).toBe('module.storage_ore');
  });
});


describe('damage, flicker and destroyed art', () => {
  const reactor = content.modules['module.reactor']!;
  const base = 'module.reactor.r1';
  const ids = new Set([base, `${base}.unpowered`, `${base}.damaged`, `${base}.damaged.flicker`, `${base}.destroyed`]);
  const look = (o: { hp: number; off?: boolean; now?: number; has?: (id: string) => boolean }) =>
    ({ off: !!o.off, now: o.now ?? 0, hp: o.hp, maxHp: reactor.maxHp, has: o.has ?? ((id: string) => ids.has(id)) });
  const head = (l: ReturnType<typeof look>, active = false) => stateArt(reactor, 1, active, l).head[0];
  const hurt = Math.floor(reactor.maxHp * DAMAGED_BELOW) - 1;

  it('healthy powered and unpowered keep their usual art', () => {
    expect(head(look({ hp: reactor.maxHp }))).toBeUndefined();
    expect(head(look({ hp: reactor.maxHp, off: true }))).toBe(`${base}.unpowered`);
  });
  it('destroyed beats everything, damaged beats unpowered', () => {
    expect(head(look({ hp: 0 }))).toBe(`${base}.destroyed`);
    expect(head(look({ hp: 0, off: true }))).toBe(`${base}.destroyed`);
    expect(head(look({ hp: hurt, off: true }))).toBe(`${base}.damaged.flicker`);
  });
  it('a powered damaged machine flickers 340 ms lit, 170 ms dark, swapping textures of one animation', () => {
    const at = (now: number) => stateArt(reactor, 1, true, look({ hp: hurt, now }));
    expect(at(0).head[0]).toBe(`${base}.damaged`);
    expect(at(FLICKER_LIT_MS - 1).head[0]).toBe(`${base}.damaged`);
    expect(at(FLICKER_LIT_MS).head[0]).toBe(`${base}.damaged.flicker`);
    expect(at(FLICKER_LIT_MS + FLICKER_DARK_MS).head[0]).toBe(`${base}.damaged`);
    expect(at(0).anim).toBe(`${base}.damaged`);
    expect(at(FLICKER_LIT_MS).anim).toBe(at(0).anim);
  });
  it('is only slightly hurt above half hp', () => {
    expect(head(look({ hp: reactor.maxHp * DAMAGED_BELOW }))).toBeUndefined();
  });
  it('art without damage or flicker variants falls back', () => {
    const none = (id: string) => id === base;
    expect(head(look({ hp: 0, has: none }))).toBeUndefined();
    expect(head(look({ hp: hurt, has: none }))).toBeUndefined();
    expect(head(look({ hp: hurt, has: (id) => id === `${base}.damaged` }))).toBe(`${base}.damaged`);
  });
});

describe('ruin look merged with the live state', () => {
  const chain = ['m.r0.damaged.flicker', 'm.r0', 'm.r0', 'm'];
  it('puts the live damage frame ahead of the ruin suffix stand-ins', () => {
    expect(mergeRuinChain(chain, 1, [], ['m.r0.damaged', 'm.damaged'])).toEqual(['m.r0.damaged.flicker', 'm.r0.damaged', 'm.damaged', 'm.r0', 'm.r0', 'm']);
  });
  it('keeps explicit ruin art first and changes nothing without a ruin', () => {
    expect(mergeRuinChain(chain, 1, ['ruin.art'], ['m.damaged'])[0]).toBe('ruin.art');
    expect(mergeRuinChain(chain, 1, [], [])).toEqual(chain);
    expect(mergeRuinChain(chain, 0, [], ['m.damaged'])).toEqual(['m.damaged', ...chain]);
  });
});
