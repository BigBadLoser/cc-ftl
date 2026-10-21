import { describe, expect, it } from 'vitest';
import { hullSum } from './combat/hull';
import { conductanceMap, diffuseStep, fieldFrame } from './diffusion';
import { DenseGrid, type GridLike } from './grid';
import { ShipGrid } from './shipGrid';
import { newSectorGrid, stampGrid } from './stamp';
import { gridFromTemplate } from './ship';
import { Struct, gasConductance } from './structure';

/** The pre-sector full sweep (every tile, every link), kept here as the reference the active-list version must match. */
function referenceStep(grid: GridLike, fields: Float64Array[], kNormal: number, kVent: number, floorAtZero: boolean): void {
  const { width, height } = grid;
  const struct = grid.load('struct');
  const door = grid.load('door');
  const cond = struct.map((k, i) => gasConductance(k, door[i] as number));
  const delta = fields.map(() => new Float64Array(struct.length));
  const link = (i: number, j: number): void => {
    const c = Math.min(cond[i] as number, cond[j] as number);
    if (c <= 0) return;
    const si = struct[i] === Struct.Space;
    const sj = struct[j] === Struct.Space;
    if (si && sj) return;
    const k = (si || sj ? kVent : kNormal) * c;
    fields.forEach((v, f) => {
      const d = k * ((v[i] as number) - (v[j] as number));
      if (!si) delta[f]![i]! -= d;
      if (!sj) delta[f]![j]! += d;
    });
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (x < width - 1) link(i, i + 1);
      if (y < height - 1) link(i, i + width);
    }
  }
  fields.forEach((v, f) => {
    for (let i = 0; i < v.length; i++) {
      if (delta[f]![i] === 0) continue;
      const next = v[i]! + delta[f]![i]!;
      v[i] = floorAtZero && next < 0 ? 0 : next;
    }
  });
}

/** A sparse truss-like hull: two pods joined by a corridor, with a breach and a half-open door, inside a wide bbox. */
const ROWS = [
  '..............................',
  '.#####..................#####.',
  '.#___####################___#.',
  '.#___D__________________D___..',
  '.#___####################___#.',
  '.#####..................#####.',
  '..............................',
  '..............................',
  '..............................',
];

describe('active-list diffusion', () => {
  it('matches the full sweep exactly, tick after tick', () => {
    const grid = gridFromTemplate({ name: 't', rows: ROWS });
    grid.set('door', 5, 3, 120);
    const frame = fieldFrame(grid);
    const cond = conductanceMap(grid, frame);
    const a = [grid.load('o2'), grid.load('co2')];
    const b = a.map((v) => v.slice());
    a[1]![3 * 30 + 2] = 9;
    b[1]![3 * 30 + 2] = 9;
    for (let s = 0; s < 200; s++) {
      diffuseStep(frame, cond, a, 0.2, 0.45, true);
      referenceStep(grid, b, 0.2, 0.45, true);
    }
    expect(a[0]).toEqual(b[0]);
    expect(a[1]).toEqual(b[1]);
    expect(a[0]![3 * 30 + 15]).not.toBe(b[0]![0]); // something moved
  });

  it('lists only structure and the vacuum touching it', () => {
    const frame = fieldFrame(gridFromTemplate({ name: 't', rows: ROWS }));
    const solid = ROWS.join('').split('').filter((c) => c !== '.').length;
    expect(frame.active.length).toBeGreaterThan(solid);
    expect(frame.active.length).toBeLessThan(ROWS.length * 30 * 0.65);
    expect(frame.active).not.toContain(7 * 30 + 15); // deep vacuum between the pods
    expect(frame.active).not.toContain(0);
    expect([...frame.active]).toEqual([...frame.active].sort((x, y) => x - y));
  });

  it('rebuilds when the structure changes', () => {
    const grid = gridFromTemplate({ name: 't', rows: ROWS });
    const before = fieldFrame(grid);
    expect(fieldFrame(grid)).toBe(before);
    grid.set('struct', 15, 7, Struct.Floor);
    expect(fieldFrame(grid).active).toContain(7 * 30 + 15);
  });
});

describe('load', () => {
  it('copies a dense grid and a window the same way, including a frame past the window', () => {
    const dense = new DenseGrid(1, 6, 4, { struct: 'u8', smoke: 'u8' });
    dense.set('smoke', 2, 1, 50);
    expect(dense.load('smoke')[6 + 2]).toBe(50);
    expect([...dense.load('smoke', { x: 1, y: 1, w: 2, h: 1 })]).toEqual([0, 50]);
    expect(() => dense.load('smoke', { x: -1, y: 0, w: 2, h: 1 })).toThrow(RangeError);
    const sector = newSectorGrid();
    stampGrid(sector, gridFromTemplate({ name: 't', rows: ['#_#'] }), 10, 10);
    const win = new ShipGrid(1, sector, 10, 10, 3, 1);
    win.set('smoke', 11, 10, 7);
    expect([...win.load('smoke')]).toEqual([0, 7, 0]);
    expect([...win.load('struct', { x: 9, y: 10, w: 5, h: 1 })]).toEqual([0, 2, 1, 2, 0]);
  });
});

describe('hullSum', () => {
  it('is cached on the hp and struct revisions', () => {
    const grid = gridFromTemplate({ name: 't', rows: ['###', '#_#', '###'] });
    expect(hullSum(grid)).toBe(8 * 255);
    grid.set('hp', 0, 0, 5);
    expect(hullSum(grid)).toBe(7 * 255 + 5);
    grid.set('struct', 1, 0, Struct.Floor);
    expect(hullSum(grid)).toBe(6 * 255 + 5);
  });
});
