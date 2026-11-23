import { describe, expect, it } from 'vitest';
import type { ModuleDef } from '../registry';
import { bedEnds, rigFitsBed, rigFront } from './rig';

// Only the footprint matters to the geometry.
const RIG = { footprint: [1, 1] } as unknown as ModuleDef;
const BED = { footprint: [1, 2] } as unknown as ModuleDef;

/** Every (x, y, rot) round a bed at (0, 0, brot) where a rig fits it. */
function fits(brot: number): string[] {
  const out: string[] = [];
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) for (let rot = 0; rot < 4; rot++) {
    if (rigFitsBed(RIG, x, y, rot, BED, 0, 0, brot)) out.push(`${x},${y} r${rot}`);
  }
  return out;
}

describe('surgical rig placement (#311)', () => {
  it('a 1x1 rig faces local +y, turned with its rotation', () => {
    expect([0, 1, 2, 3].map((r) => rigFront(RIG, 5, 5, r))).toEqual([{ x: 5, y: 6 }, { x: 4, y: 5 }, { x: 5, y: 4 }, { x: 6, y: 5 }]);
  });

  it('fits only from the two long sides of the foot, facing it, in every bed rotation', () => {
    for (let brot = 0; brot < 4; brot++) {
      const { head, foot } = bedEnds(BED, 0, 0, brot);
      const spots = fits(brot);
      expect(spots, `bed r${brot}`).toHaveLength(2);
      for (const s of spots) {
        const [x, y] = s.split(' ')[0]!.split(',').map(Number) as [number, number];
        expect(Math.abs(x - foot.x) + Math.abs(y - foot.y)).toBe(1); // beside the foot
        expect([Math.abs(x - head.x), Math.abs(y - head.y)]).toEqual([1, 1]); // diagonal to the head: on a long side, not past the end
      }
    }
  });

  it('refuses a rig facing the head, or the foot along the bed axis', () => {
    // Bed r0: head (0, 0), foot (0, 1).
    expect(rigFitsBed(RIG, 1, 1, 1, BED, 0, 0, 0)).toBe(true); // right of the foot, facing -x
    expect(rigFitsBed(RIG, -1, 1, 3, BED, 0, 0, 0)).toBe(true); // left of the foot, facing +x
    expect(rigFitsBed(RIG, 1, 0, 1, BED, 0, 0, 0)).toBe(false); // beside the head
    expect(rigFitsBed(RIG, 0, -1, 0, BED, 0, 0, 0)).toBe(false); // above the head, facing it
    expect(rigFitsBed(RIG, 0, 2, 2, BED, 0, 0, 0)).toBe(false); // past the foot, along the axis
    expect(rigFitsBed(RIG, 1, 1, 3, BED, 0, 0, 0)).toBe(false); // beside the foot, facing away
  });
});
