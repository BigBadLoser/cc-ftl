import { describe, expect, it } from 'vitest';
import type { ModuleDef } from '../registry';
import { seatPoints, seatTile } from './seats';

const bench = { name: 'Bench', footprint: [2, 1], maxHp: 10, power: 0, solid: false, seats: { kind: 'bench', at: [[-0.6, -0.11], [0, -0.11], [0.6, -0.11]] } } as unknown as ModuleDef;
/** render/iso.ts `iso` (a sim test cannot import render): 2:1 projection, 128x64 tiles. */
const iso = (gx: number, gy: number): { x: number; y: number } => ({ x: (gx - gy) * 64, y: (gx + gy) * 32 });
const near = (a: number, b: number): void => expect(a).toBeCloseTo(b, 6);

describe('bench seats', () => {
  it('lands sitters where the lab panel puts them: the screen offset from the bench sprite anchor (its front tile) at every rotation', () => {
    // The lab's own formula (tools/lab/bench.ts, verified against the sprites): local (u, v) turned by rotation, relative to the front-most tile.
    const SEATS = [[-0.6, -0.11], [0, -0.11], [0.6, -0.11]] as const;
    const lab = (rot: number, u: number, v: number) => {
      const [x, y] = ([[u, v], [-v, u], [-u, -v], [v, -u]] as const)[rot] as readonly [number, number];
      const [w, d] = rot % 2 === 0 ? [2, 1] : [1, 2];
      return iso(x - (w - 1) / 2, y - (d - 1) / 2);
    };
    for (let rot = 0; rot < 4; rot++) {
      const [w, d] = rot % 2 === 0 ? [2, 1] : [1, 2];
      const m = { x: 7, y: 3, rot };
      const front = { x: m.x + w - 1, y: m.y + d - 1 }; // moduleView anchors the sprite at tile (front.x, front.y), crewView draws a sitter at iso(seat point)
      SEATS.forEach(([u, v], k) => {
        const p = seatPoints(bench, m)[k]!;
        const got = iso(p.x - front.x, p.y - front.y), want = lab(rot, u, v);
        near(got.x, want.x);
        near(got.y, want.y);
      });
    }
  });

  it('puts the three seats where the lab panel does, at all four rotations (offsets from the footprint centre, rotated)', () => {
    const at = (rot: number) => seatPoints(bench, { x: 4, y: 2, rot });
    // r0: footprint 2x1 at (4,2): centre (4.5, 2).
    [[3.9, 1.89], [4.5, 1.89], [5.1, 1.89]].forEach(([x, y], i) => { near(at(0)[i]!.x, x!); near(at(0)[i]!.y, y!); });
    // r1: 1x2, centre (4, 2.5): (u,v) -> (-v, u).
    [[4.11, 1.9], [4.11, 2.5], [4.11, 3.1]].forEach(([x, y], i) => { near(at(1)[i]!.x, x!); near(at(1)[i]!.y, y!); });
    // r2: 2x1, centre (4.5, 2): (u,v) -> (-u,-v).
    [[5.1, 2.11], [4.5, 2.11], [3.9, 2.11]].forEach(([x, y], i) => { near(at(2)[i]!.x, x!); near(at(2)[i]!.y, y!); });
    // r3: 1x2, centre (4, 2.5): (u,v) -> (v,-u).
    [[3.89, 3.1], [3.89, 2.5], [3.89, 1.9]].forEach(([x, y], i) => { near(at(3)[i]!.x, x!); near(at(3)[i]!.y, y!); });
    // Every seat belongs to a footprint tile.
    for (let rot = 0; rot < 4; rot++) for (let i = 0; i < 3; i++) {
      const t = seatTile(bench, { x: 4, y: 2, rot }, i);
      expect(t.x >= 4 && t.x <= (rot % 2 ? 4 : 5) && t.y >= 2 && t.y <= (rot % 2 ? 3 : 2)).toBe(true);
    }
  });
});
