import { describe, expect, it } from 'vitest';
import { content } from '../../../content';
import type { ModuleDef } from '../../registry';
import { roomQuality } from './quality';

const defs = content.modules as unknown as Record<string, ModuleDef>;
const roomOf = (rows: string[]): Int16Array => {
  const w = Math.max(...rows.map((r) => r.length));
  return Int16Array.from({ length: w * rows.length }, (_, i) => (rows[Math.floor(i / w)]?.[i % w] === '_' ? 0 : -1));
};

describe('room quality', () => {
  const rows = ['#######', '#_____#', '#_____D', '#_____#', '#######'];
  it('an empty room is open, unobstructed and has no pieces to place', () => {
    const [q] = roomQuality({ rows, modules: [], roomOf: roomOf(rows), defs });
    expect(q).toMatchObject({ floor: 15, pieces: 0, pockets: 0, alignment: 1, balance: 0, density: 0 });
    expect(q!.openness).toBe(1);
  });
  it('counts a leftover nook between pieces as a pocket, and a piece off every wall and line as unaligned', () => {
    // Lockers boxing in the corner tile (1, 1): it keeps one free neighbour and nobody uses it.
    const mods = [{ def: 'module.storage_locker', x: 2, y: 1, rot: 0 }, { def: 'module.storage_locker', x: 1, y: 3, rot: 2 }];
    const [q] = roomQuality({ rows, modules: mods, roomOf: roomOf(rows), defs });
    expect(q!.pockets).toBeGreaterThan(0);
    const lone = roomQuality({ rows: ['#########', '#_______#', '#_______#', '#_______#', '#_______#', '#_______D', '#########'], modules: [{ def: 'module.planter', x: 4, y: 3, rot: 0 }], roomOf: roomOf(['#########', '#_______#', '#_______#', '#_______#', '#_______#', '#_______D', '#########']), defs });
    expect(lone[0]!.alignment).toBe(0);
  });
});
