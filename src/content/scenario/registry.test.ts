import { describe, expect, it } from 'vitest';
import { canonical, checkSpec, hooks, mergeSpec, parseScenarioUrl, partKeys, parts, presets, type ScenarioSpec } from '.';

describe('scenario registry', () => {
  it('finds the parts by glob in a valid order: unique keys, every `after` resolvable and applied first', () => {
    // (a duplicate key, an unknown `after` or a cycle throws when the registry loads, so reaching here already proves them)
    const keys = partKeys();
    expect(new Set(keys).size).toBe(keys.length);
    for (const p of parts) for (const a of p.after ?? []) expect(keys.indexOf(a as string), `${p.key as string} after ${a as string}`).toBeLessThan(keys.indexOf(p.key as string));
    expect(parts.filter((p) => p.create)).toHaveLength(1);
  });

  it('every preset builds a spec whose every key has a part, and every hook it names exists', () => {
    expect(presets.size).toBeGreaterThan(0);
    for (const [name, preset] of presets) {
      const spec = preset.spec({});
      expect(() => checkSpec(spec), name).not.toThrow();
      for (const h of spec.hooks ?? []) expect(hooks.has(h.name), `${name} hook ${h.name}`).toBe(true);
    }
  });

  it('a spec key no part owns is an error, not ignored', () => {
    expect(() => checkSpec({ nonsense: 1 } as unknown as ScenarioSpec)).toThrow(/no part for key/);
  });
});

describe('scenario overrides', () => {
  it('merges objects, replaces arrays, deletes on null, and leaves the base alone', () => {
    const base = { items: { credits: 5, give: { a: 1 } }, hooks: [{ name: 'x' }], ui: { speed: 1 } } as unknown as ScenarioSpec;
    const out = mergeSpec(base, { items: { give: { b: 2 } }, hooks: [], ui: null } as unknown as ScenarioSpec) as Record<string, unknown>;
    expect(out['items']).toEqual({ credits: 5, give: { a: 1, b: 2 } });
    expect(out['hooks']).toEqual([]);
    expect('ui' in out).toBe(false);
    expect((base as Record<string, unknown>)['ui']).toEqual({ speed: 1 });
  });

  it('canonical keys do not depend on property order, and refuse functions', () => {
    expect(canonical({ a: 1, b: { c: 2, d: 3 } })).toBe(canonical({ b: { d: 3, c: 2 }, a: 1 }));
    expect(() => canonical({ f: () => 1 })).toThrow();
  });
});

describe('?scenario= parsing', () => {
  it('reads a preset, its declared params and the flat overrides; ignores the rest', () => {
    const u = parseScenarioUrl('?scenario=inspect&clean&stage=search&bogus=1&seed=7&credits=900&items=fuel:80,item.metal:5&speed=2&hooks=inspect.fight&ticks=30');
    expect(u?.name).toBe('inspect');
    expect(u?.params).toEqual({ clean: true, stage: 'search' });
    expect(u?.overrides).toEqual({ items: { credits: 900, give: { 'item.fuel': 80, 'item.metal': 5 } }, ui: { speed: 2 } });
    expect(u?.seed).toBe(7);
    expect(u?.extraHooks).toEqual(['inspect.fight']);
    expect(u?.ticks).toBe(30);
  });

  it('an unknown or missing preset is no scenario; a bad enum value is dropped', () => {
    expect(parseScenarioUrl('?scenario=nope')).toBeNull();
    expect(parseScenarioUrl('?seed=3')).toBeNull();
    expect(parseScenarioUrl('?scenario=inspect&stage=zzz')?.params).toEqual({});
  });
});
