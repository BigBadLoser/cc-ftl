import { describe, expect, it } from 'vitest';
import { cellOf, type Manifest } from './manifest';

const raws = import.meta.glob('../../../public/assets/*/manifest.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
/** Every sheet image under public/assets (keys only: nothing is loaded). */
const files = new Set(Object.keys(import.meta.glob('../../../public/assets/*/sprites/*.png')).map((k) => k.replace('../../../public/assets/', '')));
const load = (dir: string): Manifest => JSON.parse(raws[`../../../public/assets/${dir}/manifest.json`] as string) as Manifest;

const dir = '1x';
const m = load(dir);

describe('shipped manifest', () => {
  it('has the tile size of the art', () => {
    expect(m.tile).toEqual({ w: 64, h: 32 });
    if (m.heights) expect(m.heights.zPx).toBeCloseTo(39.1918, 2);
  });
  it('crew clip cells (trimmed or not) lie inside the layer frame', () => {
    let n = 0;
    for (const [id, a] of Object.entries(m.assets)) {
      if (a.kind !== 'crew.layer') continue;
      for (const [name, c] of Object.entries(a.clips)) {
        const cell = cellOf(a, c);
        expect(cell.w, `${id}.${name}`).toBeGreaterThan(0);
        expect(cell.h, `${id}.${name}`).toBeGreaterThan(0);
        expect(cell.ox + cell.w, `${id}.${name} width`).toBeLessThanOrEqual(a.frameW);
        expect(cell.oy + cell.h, `${id}.${name} height`).toBeLessThanOrEqual(a.frameH);
        n++;
      }
    }
    expect(n).toBeGreaterThan(100);
  });
  it('every asset names a sheet the manifest has', () => {
    for (const [id, a] of Object.entries(m.assets)) {
      const names = a.kind === 'static' ? [a.sheet] : [...Object.values(a.clips).map((c) => c.sheet ?? a.sheet), a.sheet];
      for (const s of names) if (s !== undefined) expect(m.sheets[s], `${id} -> ${s}`).toBeDefined();
    }
  });
  it('every sheet image and glow exists under the set', () => {
    for (const [name, sh] of Object.entries(m.sheets)) {
      expect(files.has(`${dir}/${sh.image}`), `${name} image ${sh.image}`).toBe(true);
      if (sh.glow) expect(files.has(`${dir}/${sh.glow}`), `${name} glow ${sh.glow}`).toBe(true);
    }
  });
});
