import { describe, expect, it } from 'vitest';
import type { ModuleDef } from '../registry';
import { groundPort, rotForPortDir } from './groundMount';

const def = { footprint: [3, 3], solid: true, groundMount: true } as unknown as ModuleDef;

describe('ground mount port', () => {
  it('plugs in at the middle of the side the rotation faces, clockwise from +x', () => {
    const at = (rot: number) => groundPort(def, { x: 10, y: 20, rot });
    expect(at(0)).toMatchObject({ side: { x: 12, y: 21 }, cable: { x: 13, y: 21 } });
    expect(at(1)).toMatchObject({ side: { x: 11, y: 22 }, cable: { x: 11, y: 23 } });
    expect(at(2)).toMatchObject({ side: { x: 10, y: 21 }, cable: { x: 9, y: 21 } });
    expect(at(3)).toMatchObject({ side: { x: 11, y: 20 }, cable: { x: 11, y: 19 } });
    for (const r of [0, 1, 2, 3]) expect(rotForPortDir(at(r).dir.x * 2, at(r).dir.y * 2)).toBe(r);
  });
});
