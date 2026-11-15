import { describe, expect, it } from 'vitest';
import type { ModuleDef } from '../registry';
import { E, edgeMarkings, N, outline, S, W } from './markings';
import type { GenResult } from './types';

/** A layout from rows; room 0 is the hall (every '_' in `hall` rows marked h), room 1 a reactor (r). */
function gen(rows: string[], rooms: string[], modules: { def: string; x: number; y: number; rot?: number }[] = []): GenResult {
  const width = rows[0]!.length, height = rows.length;
  const roomOf = new Int16Array(width * height).fill(-1);
  rooms.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'h') roomOf[y * width + x] = 0; if (c === 'r') roomOf[y * width + x] = 1; }));
  return { template: { rows, modules }, rooms: [{ id: 0, role: 'hall', tiles: [] }, { id: 1, role: 'reactor', tiles: [] }], roomOf, width, height } as unknown as GenResult;
}
const mask = (m: Uint8Array, w: number, x: number, y: number): number => m[y * w + x] ?? 0;

describe('edge markings', () => {
  it('outlines a region: a 2x1 box has its ends and long sides, no seam between', () => {
    const m = outline(4, 3, (i) => i === 5 || i === 6);
    expect([m[5], m[6]]).toEqual([N | S | W, N | E | S]);
  });

  it('runs walkway lines a tile in from a 5-wide corridor wall, broken where a door opens', () => {
    const rows = ['###D###', '#_____#', '#_____#', '#_____#', '#_____#', '#_____#', '#######'];
    const rooms = ['.......', '.hhhhh.', '.hhhhh.', '.hhhhh.', '.hhhhh.', '.hhhhh.', '.......'];
    const { walkway, apron } = edgeMarkings(gen(rows, rooms), {});
    // the lane is x 2..4, y 2..4: its west side carries the line all the way down, and nothing runs inside it
    expect([2, 3, 4].map((y) => mask(walkway, 7, 2, y) & W)).toEqual([W, W, W]);
    expect(mask(walkway, 7, 3, 3)).toBe(0);
    // its north side breaks under the door: (3,2) faces the margin tile in front of the door (3,1)
    expect(mask(walkway, 7, 2, 2) & N).toBe(N);
    expect(mask(walkway, 7, 3, 2) & N).toBe(0);
    // the apron sits on the floor tile facing the door
    expect(mask(apron, 7, 3, 1)).toBe(N);
  });

  it('runs a centre line down a 2-wide corridor, over its doors', () => {
    const rows = ['##D###', '#____#', '#____#', '######'];
    const rooms = ['......', '.hhhh.', '.hhhh.', '......'];
    const { walkway } = edgeMarkings(gen(rows, rooms), {});
    expect([1, 2, 3, 4].map((x) => mask(walkway, 6, x, 1))).toEqual([S, S, S, S]);
    expect([1, 2, 3, 4].map((x) => mask(walkway, 6, x, 2))).toEqual([0, 0, 0, 0]);
  });

  it('boxes the open access tiles of machines and bands a reactor along its walls, not across its door', () => {
    const rows = ['#####', '#___#', '#___#', '##D##'];
    const rooms = ['.....', '.rrr.', '.rrr.', '.....'];
    const defs = { 'module.box': { footprint: [1, 1], access: [0, 1], category: 'production' } as unknown as ModuleDef };
    const g = gen(rows, rooms, [{ def: 'module.box', x: 2, y: 1 }]);
    const { keepClear, hazard } = edgeMarkings(g, defs);
    expect(mask(keepClear, 5, 2, 2)).toBe(N | E | S | W);
    expect(mask(hazard, 5, 1, 1)).toBe(N | W);
    expect(mask(hazard, 5, 2, 2)).toBe(0); // the door below is not a wall
    expect(mask(hazard, 5, 1, 2)).toBe(S | W);
  });
});
