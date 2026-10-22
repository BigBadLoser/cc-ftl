import { describe, expect, it } from 'vitest';
import { Builder } from './builder';
import { Rng } from '../rng';
import { thinWalls } from './thinWalls';

const opts = { canGrow: () => true, rank: () => 0, axis2: 0 };
const rows = (b: Builder): string[] => b.cv.crop().rows;

describe('thinWalls', () => {
  it('folds a double partition into one wall', () => {
    const b = new Builder(new Rng(1));
    b.place({ x: 0, y: 0, w: 5, h: 5 }, 'cargo');
    b.place({ x: 5, y: 0, w: 5, h: 5 }, 'quarters');
    expect(rows(b)[2]).toBe('.#___##___#.');
    thinWalls(b.cv, opts);
    expect(rows(b)[2]).toBe('.#____#___#.');
  });

  it('turns a slab into floor of the room beside it, keeping one wall on open space', () => {
    const b = new Builder(new Rng(1));
    b.place({ x: 0, y: 0, w: 5, h: 5 }, 'cargo');
    b.cv.stamp(['#####', '#####', '#####', '#####', '#####'], 4, 0, 'slab');
    thinWalls(b.cv, opts);
    expect(rows(b)[2], rows(b).join('\n')).toBe('.#_______#.');
  });

  it('folds the inner wall of a double hull and keeps the outline', () => {
    const b = new Builder(new Rng(1));
    b.place({ x: 1, y: 1, w: 5, h: 5 }, 'cargo');
    b.cv.stamp(['#######', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#######'], 0, 0, 'hull');
    const t = thinWalls(b.cv, opts);
    expect(t.outlineChanged).toBe(0);
    expect(rows(b)[1]).toBe('.#######.');
    expect(rows(b)[3]).toBe('.#_____#.');
  });

  it('never removes a stair-stepped edge', () => {
    const b = new Builder(new Rng(1));
    b.place({ x: 0, y: 0, w: 6, h: 5 }, 'cargo');
    b.cv.stamp(['##....', '###...', '####..'], 5, 0, 'step');
    const before = rows(b).join('\n');
    const t = thinWalls(b.cv, opts);
    expect(t.outlineChanged).toBe(0);
    expect(rows(b).join('\n').replace(/_/g, '#')).toBe(before.replace(/_/g, '#'));
  });
});
