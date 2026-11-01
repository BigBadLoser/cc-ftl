import { describe, expect, it } from 'vitest';
import { accessTile } from '../../modules/footprint';
import type { ModuleDef } from '../../registry';
import { Layout } from '../layout';
import { at, frame, framed, roomRect } from './frame';

const defs: Record<string, ModuleDef> = {
  'module.console': { name: 'c', asset: 'c', footprint: [1, 1], solid: true, power: 0, access: [0, 1] } as unknown as ModuleDef,
  'module.bunk': { name: 'b', asset: 'b', footprint: [1, 2], solid: true, power: 0, access: [0, 2] } as unknown as ModuleDef,
};
const rows = ['########', '#______#', '#______#', '#______#', '#______#', '########'];
const roomOf = Int16Array.from({ length: 48 }, (_, i) => (rows[Math.floor(i / 8)]?.[i % 8] === '_' ? 0 : -1));

describe('room frame', () => {
  const lay = new Layout(rows, roomOf, ['cargo'], defs);
  const rect = roomRect(lay, 0)!;
  it('reads the room as a rectangle, its long side the back in turns 0 and 2', () => {
    expect(rect).toEqual({ x0: 1, y0: 1, x1: 6, y1: 4 });
    expect([frame(rect, 0).L, frame(rect, 0).D, frame(rect, 1).L, frame(rect, 1).D]).toEqual([6, 4, 4, 6]);
  });
  it('sets a piece with turn 0 facing into the room in every turn of the frame', () => {
    for (const o of [0, 1, 2, 3]) {
      const f = frame(rect, o);
      for (const def of ['module.console', 'module.bunk']) {
        const pm = framed(lay, f, def, 1, 0, 0);
        const fpDepth = def === 'module.bunk' ? 2 : 1;
        expect(accessTile(defs[def]!, pm.x, pm.y, pm.rot), `${def} turn ${o}`).toEqual(at(f, 1, fpDepth));
      }
    }
  });
});
