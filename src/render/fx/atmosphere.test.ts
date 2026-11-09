import { describe, expect, it } from 'vitest';
import { World } from '../../sim/ecs';
import { ShipGrid } from '../../sim/shipGrid';
import { newSectorGrid } from '../../sim/stamp';
import { Struct } from '../../sim/structure';
import { createAtmosphere } from './atmosphere';
import type { Particles } from './particles';

/** A floor room with a hull ring, one hull tile opened to space at (5, 0), smoke at (3, 3), fire at (4, 3). */
function room(): ShipGrid {
  const sector = newSectorGrid();
  const ox = 20, oy = 30, w = 10, h = 8;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      sector.set('struct', ox + x, oy + y, edge && !(x === 5 && y === 0) ? Struct.Wall : x === 5 && y === 0 ? Struct.Space : Struct.Floor);
      if (!edge) sector.set('o2', ox + x, oy + y, 21);
    }
  sector.set('smoke', ox + 3, oy + 3, 120);
  sector.set('fire', ox + 4, oy + 3, 200);
  return new ShipGrid(1, sector, ox, oy, w, h);
}

function recorder(): { p: Particles; keys: string[] } {
  const keys: string[] = [];
  const p = { emit: (key: string) => void keys.push(key), burst() {}, update() {}, count: () => 0, dispose() {} } as unknown as Particles;
  return { p, keys };
}

describe('atmosphere', () => {
  it('vents air at floor tiles beside space, smokes and burns where the fields say, nothing elsewhere', () => {
    const grid = room();
    const { p, keys } = recorder();
    const a = createAtmosphere(new World(), p, {}, { target: () => ({ grid }) });
    a.update(0.1);
    const w = grid.width;
    // (5, 1) is the floor tile under the hole: it vents toward -y (direction 3).
    expect(keys).toEqual([`va${1 * w + 5}.3`, `vi${1 * w + 5}.3`, `s${3 * w + 3}`, `e${3 * w + 4}`]); // row by row
  });

  it('follows a struct change (the hole closed) and an emptied room', () => {
    const grid = room();
    const { p, keys } = recorder();
    const a = createAtmosphere(new World(), p, {}, { target: () => ({ grid }) });
    a.update(0.1);
    grid.set('struct', grid.x0 + 5, grid.y0, Struct.Wall);
    keys.length = 0;
    a.update(0.1);
    expect(keys.filter((k) => k.startsWith('v'))).toEqual([]);
    grid.set('struct', grid.x0 + 5, grid.y0, Struct.Space);
    grid.set('o2', grid.x0 + 5, grid.y0 + 1, 0);
    keys.length = 0;
    a.update(0.1);
    expect(keys.filter((k) => k.startsWith('v'))).toEqual([]);
  });
});
