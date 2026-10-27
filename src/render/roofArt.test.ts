import { describe, expect, it } from 'vitest';
import { LIVERIES, liveryFor, liveryPlan, moduleColour, moduleLayout, roofTile, SCHEME_NAMES } from './roofArt';

// Reference values computed with the Blender pipeline's pure-Python roof_layout / roof_variants / roof_livery.
const MASKS = new Set(
  ('stripe.n stripe.s pin.n pin.s pinp.n pinp.s chev.n chev.s saddle.w saddle.e aft.0 aft.1 aft.2 reg.0 reg.1 reg.2 reg.3 reg.4 ' +
    'reg.5 reg.6 reg.7 reg.8 reg.9 em.dot.0 em.dot.1 em.dot.2 em.dot.3 em.delta.0 em.delta.1 em.delta.2 em.delta.3 em.cross.0 ' +
    'em.cross.1 em.cross.2 em.cross.3 em.star.0 em.star.1 em.star.2 em.star.3 em.diamond.0 em.diamond.1 em.diamond.2 em.diamond.3 ' +
    'full.P half.n dbl.n dbl.s shaft.n shaft.s bar arr.0.0 arr.0.1 arr.0.2 arr.0.3 arr.1.1 arr.1.2 big.0.0 big.0.1 big.1.0 big.1.1 ' +
    'big.2.0 big.2.1 big.3.0 big.3.1 big.4.0 big.4.1 big.5.0 big.5.1 big.6.0 big.6.1 big.7.0 big.7.1 big.8.0 big.8.1 big.9.0 big.9.1 ' +
    'sten.0 sten.1 em.skull.0 em.skull.1 em.skull.2 em.skull.3 em.eye.0 em.eye.1 em.eye.2 em.eye.3 fang claw.0 claw.1 claw.2 claw.4 claw.5 claw.6 claw.7 claw.9 claw.10 claw.11 trace.n ' +
    'trace.s ' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map((q) => `emL.skull.${q} emL.eye.${q}`).join(' ')).split(' '),
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
      gash: [240, 290], scorch: [240, 290], reaver: [240, 295], litany: [240, 284], relic: [240, 320], vigil: [240, 289],
    };
    for (const sc of SCHEME_NAMES) {
      const p = liveryPlan(24, 16, solid, sc, 42, (m) => MASKS.has(m));
      expect([p.size, [...p.values()].reduce((a, l) => a + l.length, 0)], sc).toEqual(want[sc]);
    }
    const t = liveryPlan(24, 16, solid, 'tricolour', 42, (m) => MASKS.has(m));
    expect(['15,9', '16,9', '17,9'].map((k) => t.get(k)?.map((q) => q.mask))).toEqual([['big.1.0'], ['big.1.1'], ['big.5.0']]);
    const v = liveryPlan(24, 16, solid, 'verdant', 42, (m) => MASKS.has(m));
    expect(v.get('13,5')).toEqual([{ mask: 'em.star.0', motif: 'em.star' }]);
    const big = liveryPlan(24, 16, solid, 'vigil', 42, (m) => MASKS.has(m));
    expect(['13,6', '14,7', '15,8'].map((k) => big.get(k)?.at(-1)?.mask)).toEqual(['emL.eye.0', 'emL.eye.4', 'emL.eye.8']);
    const g = liveryPlan(24, 16, solid, 'gash', 42, (m) => MASKS.has(m));
    expect(['13,5', '7,6', '19,2', '20,2'].map((k) => g.get(k)?.map((q) => q.mask))).toEqual([
      ['full.P', 'em.skull.0'], ['full.P', 'claw.0'], ['full.P', 'fang'], ['full.P', 'full.P'],
    ]);
  });
  it('picks a scheme per ship deterministically', () => {
    expect(liveryFor('hostile', 'Raider')).toEqual(liveryFor('hostile', 'Raider'));
    expect(SCHEME_NAMES).toContain(liveryFor('hostile', 'Raider').scheme);
  });
  it('picks from the faction livery, the classic ten without one', () => {
    const names = ['Raider', 'Kestrel', 'Vow of Iron', 'Hollow Saint', 'Dust Runner', 'Pale Choir'];
    for (const n of names) {
      expect(LIVERIES['livery.raider']).toContain(liveryFor('hostile', n, 'livery.raider').scheme);
      expect(LIVERIES['livery.zealot']).toContain(liveryFor('hostile', n, 'livery.zealot').scheme);
      expect(liveryFor('hostile', n, 'livery.navy')).toEqual(liveryFor('hostile', n));
      expect(liveryFor('hostile', n, 'livery.unknown')).toEqual(liveryFor('hostile', n));
    }
  });
});

describe('roof coverage and cuts', () => {
  it('plates every ship tile and cuts the near hull, the chamfered far corner and engine rows', async () => {
    const { roofCovers, roofCut, cutSuffix, cutHides } = await import('./roofArt');
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
    expect([roofCovers(k, 2, 2), roofCovers(k, 2, 1), roofCovers(k, 3, 3), roofCovers(k, 0, 0)]).toEqual([true, true, true, false]);
    expect(roofCut(k, 2, 2)).toBe('');
    expect(roofCut(k, 2, 1)).toBe(''); // far hull: outer face on the tile edge
    expect(roofCut(k, 1, 1)).toBe('c'); // far corner, chamfered
    expect(roofCut(k, 2, 3)).toBe('s');
    expect(roofCut(k, 3, 2)).toBe('e');
    expect(roofCut(k, 3, 3)).toBe('se');
    expect([cutSuffix('se'), cutSuffix('')]).toEqual(['.cut.se', '']);
    expect([cutHides('se', 's'), cutHides('se', 'n'), cutHides('c', 'w'), cutHides('e', 'e')]).toEqual([true, false, true, true]);
  });
});

describe('livery bow at either end', () => {
  const MIRRORED = new Set(
    ('chev.n chev.s saddle.w saddle.e aft.1 aft.2 em.dot.0 em.dot.1 em.dot.2 em.dot.3 em.delta.0 em.delta.1 em.delta.2 em.delta.3 ' +
      'em.cross.0 em.cross.1 em.cross.2 em.cross.3 em.star.0 em.star.1 em.star.2 em.star.3 em.diamond.0 em.diamond.1 em.diamond.2 ' +
      'em.diamond.3 bar arr.0.0 arr.0.1 arr.0.2 arr.0.3 arr.1.1 arr.1.2').split(' ').map((m) => `${m}.m`),
  );
  const has = (m: string) => MASKS.has(m) || MIRRORED.has(m);
  const text = (m: string) => /^(reg|big|sten)\./.test(m);
  it('mirrors every motif to the other end, with mirrored masks, and keeps the text readable', () => {
    for (const sc of SCHEME_NAMES) {
      const east = liveryPlan(24, 16, solid, sc, 42, has);
      const west = liveryPlan(24, 16, solid, sc, 42, has, true);
      expect(west.size, sc).toBe(east.size);
      for (const [key, list] of east) {
        const [x, y] = key.split(',').map(Number) as [number, number];
        const other = west.get(`${23 - x},${y}`);
        expect(other?.map((q) => q.motif), `${sc} ${key}`).toEqual(list.map((q) => q.motif));
        list.forEach((q, i) => {
          const w = other?.[i]?.mask ?? '';
          if (text(q.mask)) expect(text(w)).toBe(true);
          else expect(w, `${sc} ${key}`).toBe(MIRRORED.has(`${q.mask}.m`) ? `${q.mask}.m` : q.mask);
        });
      }
      // The registry number reads the same, left to right, at the other end.
      const read = (p: Map<string, { mask: string }[]>) =>
        [...p].flatMap(([k, l]) => l.filter((q) => /^(reg|big)\./.test(q.mask)).map((q) => [Number(k.split(',')[0]), q.mask] as const))
          .sort((a, b) => a[0] - b[0]).map((e) => e[1]).join(' ');
      expect(read(west), sc).toBe(read(east));
    }
  });
  it('chevrons sit at the low-x end of a ship whose bow is west', () => {
    const west = liveryPlan(24, 16, solid, 'crimson', 42, has, true);
    const xs = [...west].filter(([, l]) => l.some((q) => q.mask.startsWith('chev.'))).map(([k]) => Number(k.split(',')[0]));
    expect(Math.max(...xs)).toBeLessThan(5);
    expect([...west.values()].flat().some((q) => q.mask === 'chev.n.m')).toBe(true);
  });
});
