import { describe, expect, it } from 'vitest';
import { liveryFor, liveryPlan, moduleColour, moduleLayout, roofTile, SCHEME_NAMES } from './roofArt';

// Reference values computed with the Blender pipeline's pure-Python roof_layout / roof_variants / roof_livery.
const MASKS = new Set(
  ('stripe.n stripe.s pin.n pin.s pinp.n pinp.s chev.n chev.s saddle.w saddle.e aft.0 aft.1 aft.2 reg.0 reg.1 reg.2 reg.3 reg.4 ' +
    'reg.5 reg.6 reg.7 reg.8 reg.9 em.dot.0 em.dot.1 em.dot.2 em.dot.3 em.delta.0 em.delta.1 em.delta.2 em.delta.3 em.cross.0 ' +
    'em.cross.1 em.cross.2 em.cross.3 em.star.0 em.star.1 em.star.2 em.star.3 em.diamond.0 em.diamond.1 em.diamond.2 em.diamond.3 ' +
    'full.P half.n dbl.n dbl.s shaft.n shaft.s bar arr.0.0 arr.0.1 arr.0.2 arr.0.3 arr.1.1 arr.1.2 big.0.0 big.0.1 big.1.0 big.1.1 ' +
    'big.2.0 big.2.1 big.3.0 big.3.1 big.4.0 big.4.1 big.5.0 big.5.1 big.6.0 big.6.1 big.7.0 big.7.1 big.8.0 big.8.1 big.9.0 big.9.1 ' +
    'sten.0 sten.1').split(' '),
);
const solid = (x: number, y: number) => x > 1 && x < 22 && y > 1 && y < 14;

describe('roof module rule', () => {
  it('matches the pipeline', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(moduleColour).join('')).toBe('bbobobobbb');
    expect([moduleLayout(0, 0), moduleLayout(1, 2), moduleLayout(5, 3)]).toEqual([3, 3, 0]);
    const ids = ([[0, 0], [5, 3], [9, 10], [13, 2], [17, 6], [22, 14], [3, 9]] as const).map(([x, y]) => roofTile(x, y).id);
    expect(ids).toEqual(['roof.c3b.00.inset', 'roof.c1b.13', 'roof.c0o.12.inset', 'roof.c1b.12', 'roof.c1o.12', 'roof.c0b.22', 'roof.c2b.31.inset']);
  });
});

describe('livery plan', () => {
  it('matches the pipeline for every scheme', () => {
    const want: Record<string, [number, number]> = {
      crimson: [43, 43], ivory: [64, 68], tide: [67, 67], sovereign: [47, 47], orchid: [73, 79], hornet: [66, 70],
      glacier: [132, 142], verdant: [58, 62], ember: [70, 70], tricolour: [148, 172],
    };
    for (const sc of SCHEME_NAMES) {
      const p = liveryPlan(24, 16, solid, sc, 42, (m) => MASKS.has(m));
      expect([p.size, [...p.values()].reduce((a, l) => a + l.length, 0)], sc).toEqual(want[sc]);
    }
    const t = liveryPlan(24, 16, solid, 'tricolour', 42, (m) => MASKS.has(m));
    expect(['15,9', '16,9', '17,9'].map((k) => t.get(k)?.map((q) => q.mask))).toEqual([['big.1.0'], ['big.1.1'], ['big.5.0']]);
    const v = liveryPlan(24, 16, solid, 'verdant', 42, (m) => MASKS.has(m));
    expect(v.get('13,5')).toEqual([{ mask: 'em.star.0', motif: 'em.star' }]);
  });
  it('picks a scheme per ship deterministically', () => {
    expect(liveryFor('hostile', 'Raider')).toEqual(liveryFor('hostile', 'Raider'));
    expect(SCHEME_NAMES).toContain(liveryFor('hostile', 'Raider').scheme);
  });
});

describe('roof coverage', () => {
  it('covers the interior, partitions, the far hull and engine hull rows, not the near hull', async () => {
    const { roofCovers } = await import('./roofArt');
    const { Struct } = await import('../sim/structure');
    const W = Struct.Wall;
    const F = Struct.Floor;
    const S = Struct.Space;
    const rows = [
      [S, S, S, S, S],
      [S, W, W, W, S],
      [S, W, F, W, S],
      [S, W, W, W, S],
      [S, S, S, S, S],
    ];
    const k = (x: number, y: number) => rows[y]?.[x] ?? S;
    expect(roofCovers(k, 2, 2)).toBe(true);
    expect(roofCovers(k, 2, 1)).toBe(true); // far (north) hull
    expect(roofCovers(k, 1, 2)).toBe(true); // far (west) hull
    expect(roofCovers(k, 2, 3)).toBe(false); // near (south) hull
    expect(roofCovers(k, 3, 2)).toBe(false); // near (east) hull
    expect(roofCovers(k, 3, 2, true)).toBe(true); // an engine's hull row
    expect(roofCovers(k, 0, 0)).toBe(false);
  });
});
