import { describe, expect, it } from 'vitest';
import { DIRS, MINE_BOB, POD_HOVER_Z, ROCK_TOP_Z, STANDOFF } from '../sim/mining/geometry';
import { Z_PX } from './heights';
import { iso } from './iso';
import { barrel, beamEnd, HIDDEN } from './podMuzzle';
import { sectorArt } from './sectorPos';

const deg = (a: readonly [number, number], b: readonly [number, number]) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
const turn = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

/** The barrel tip measured in the sheet's mine frames (last opaque pixel along the barrel axis), px from the anchor, [f0, f1] per heading; d4 to d6 are hidden. */
const MEASURED: readonly (readonly [number, number][] | null)[] = [
  [[86, 51], [86, 48]],
  null, // d1: the sheet clips the barrel at the frame's bottom edge
  [[-86, 51], [-86, 49]],
  [[-124, 11], [-124, 9]],
  null,
  null,
  null,
  [[124, 10], [124, 8]],
];

describe('mining pod laser', () => {
  it('the beam continues straight along the barrel axis on every heading, and ends on the ore tile top face', () => {
    for (let d = 0; d < 8; d++) {
      for (const f of [0, 1]) {
        const { pivot, tip } = barrel(d, f);
        const end = beamEnd(d, f);
        // the beam's on-screen angle is the barrel's
        expect(turn(deg(tip, end), deg(pivot, tip))).toBeLessThan(0.5);
        // pod on the heading ray, STANDOFF out: the beam's end is the ore tile's top face centre (bob lifts the axis by up to 1 px)
        const ore = { x: 50, y: 41 };
        const dir = DIRS[d] as readonly [number, number];
        const pod = { x: ore.x + 0.5 - dir[0] * STANDOFF, y: ore.y + 0.5 - dir[1] * STANDOFF };
        const base = sectorArt(pod.x, pod.y);
        const top = iso(ore.x, ore.y);
        const want = [top.x - base.x, top.y - ROCK_TOP_Z * Z_PX - (base.y - POD_HOVER_Z * Z_PX)];
        expect(Math.abs(end[0] - (want[0] as number))).toBeLessThan(2);
        expect(Math.abs(end[1] - (want[1] as number))).toBeLessThan(2 + (MINE_BOB[f] ?? 0) * Z_PX);
      }
    }
  });

  it('puts the tip where the sheet has the barrel tip, and hides the beam start behind the hull on d4 to d6', () => {
    MEASURED.forEach((fs, d) => {
      fs?.forEach((m, f) => {
        const { tip } = barrel(d, f);
        expect(Math.hypot(tip[0] - (m[0] as number), tip[1] - (m[1] as number))).toBeLessThan(7);
      });
    });
    expect([...HIDDEN].sort()).toEqual([4, 5, 6]);
  });
});
