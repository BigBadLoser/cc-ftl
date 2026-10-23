import { describe, expect, it } from 'vitest';
import raw from '../../../public/assets/manifest.json?raw';
import { cellOf, type Manifest } from './manifest';

const m = JSON.parse(raw) as Manifest;

describe('shipped manifest', () => {
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
});
