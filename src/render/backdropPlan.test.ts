import { describe, expect, it } from 'vitest';
import { bodySpot, backdropBodySprite, strHash } from './backdropPlan';
import { bodyVariant } from './starmap/artIds';

const ids = (list: string[]) => (id: string) => list.includes(id);
const starmap = (kind: string, n: number) => [`starmap.body.${kind}`, ...Array.from({ length: n }, (_, i) => `starmap.body.${kind}.v${i}`)];

describe('backdrop body art', () => {
  it('picks the variant as the starmap does, for three variants and for the gas giant six', () => {
    const have = [...starmap('star', 3), ...starmap('gas_giant', 6)];
    const art = { frames: Object.fromEntries(have.map((id) => [id, {}])) } as unknown as Parameters<typeof bodyVariant>[0];
    for (const sector of ['sec:0,0', 'sec:3,4', 'a', 'zz', 'sec:12,-7']) {
      for (const kind of ['star', 'gas_giant']) {
        const want = bodyVariant(art, 'body', kind, sector);
        expect(backdropBodySprite(ids(have), kind, strHash(sector))).toContain(want);
      }
    }
    const seen = new Set(Array.from({ length: 60 }, (_, i) => backdropBodySprite(ids(have), 'gas_giant', strHash(`s${i}`)).find((id) => /\.v\d$/.test(id))));
    expect(seen.size).toBe(6);
  });

  it('prefers dedicated backdrop art when it exists, then the starmap sprite, then the plain ids', () => {
    const have = [...starmap('star', 3), 'backdrop.body.star', 'backdrop.body.star.v0', 'backdrop.body.star.v1', 'backdrop.body.star.v2'];
    const [first, second] = backdropBodySprite(ids(have), 'star', 7);
    expect(first).toBe('backdrop.body.star.v1');
    expect(second).toBe('backdrop.body.star');
    expect(backdropBodySprite(ids(starmap('star', 3)), 'star', 7)[0]).toBe('backdrop.body.star');
    expect(backdropBodySprite(ids(starmap('star', 3)), 'star', 7)).toContain('starmap.body.star.v1');
    expect(backdropBodySprite(ids([]), 'pulsar', 1)).toContain('starmap.body.pulsar');
  });
});

describe('backdrop body spot', () => {
  it('stays in the left band, clear of the top bar, the goals column and the tools, for any seed', () => {
    for (let s = 0; s < 5000; s++) {
      const { fx, fy } = bodySpot(Math.imul(s, 2654435761) >>> 0);
      // radius is about 0.17 of the view height, 0.09 of the width at 1920x950
      expect(fx + 0.09).toBeLessThan(0.3);
      expect(fx).toBeGreaterThan(0.05);
      expect(fy - 0.17).toBeGreaterThan(0.06);
      expect(fy + 0.17).toBeLessThan(1.05);
    }
  });

  it('is stable for a seed and differs across seeds', () => {
    expect(bodySpot(42)).toEqual(bodySpot(42));
    const seen = new Set(Array.from({ length: 100 }, (_, i) => JSON.stringify(bodySpot(i * 7919))));
    expect(seen.size).toBeGreaterThan(3);
  });
});
