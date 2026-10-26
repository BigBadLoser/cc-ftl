import type { Block } from './arranger';
import { blockFrom, localBuilder } from './blocks';
import type { Builder } from './builder';
import { roomy } from './civilBlocks';
import { engineSpec } from './plan';
import type { Rng } from '../rng';

/**
 * Improvised scrapper pieces, patched in for what no donor brought. Each has a shape of its own so it reads as what
 * it is, not as a plain grey slab:
 *   patched reactor  the reactor room on a short access stub, radiator fins (bare truss) standing off its outer wall
 *   strapped engine  an engine nacelle on a narrow access neck, truss straps clamping the neck either side
 */

/** Stamp a run of truss cells. */
const fin = (b: Builder, x: number, y: number, w: number, h: number, key: string): void => {
  b.cv.stamp(Array.from({ length: h }, () => '='.repeat(w)), x, y, key);
};

/** A patched-in reactor room (power the donors did not bring): access stub below, radiator fins above. */
export function reactorRoom(rng: Rng, k: number): Builder | null {
  const b = localBuilder(rng);
  // One row deeper than a donor's reactor room: the patch is fitted round whatever the welds left (and leaves slack).
  const r = { ...roomy(k), h: 5 };
  const W = r.w + 2;
  const room = b.place({ x: 0, y: -r.h, w: W, h: r.h + 2 }, 'reactor', r);
  // The access stub is narrower than the room, set off-centre: welds come in through it.
  const sw = Math.min(W, 5);
  const pass = b.place({ x: rng.int(0, W - sw), y: 1, w: sw, h: 3 }, 'hall');
  if (!room || !pass || !b.door(room, pass)) return null;
  // Radiator fins on every other column of the outer wall, all the same length.
  const len = rng.int(1, 2);
  for (let x = 1 + rng.int(0, 1); x < W - 1; x += 2) fin(b, x, -r.h - len, 1, len, `fin${x}`);
  return b;
}

/** A strapped-on engine: the engine room on a narrow access neck (its port), truss straps beside the neck. */
export function strappedEngine(rng: Rng): Block {
  const b = localBuilder(rng);
  const e = engineSpec(1, 'ns');
  const W = e.w + 2;
  const H = e.h + 2;
  const eng = b.place({ x: 0, y: 0, w: W, h: H }, 'engine', e);
  const nx = 1 + rng.int(0, W - 5);
  const nh = 2 + rng.int(1, 2);
  const neck = b.place({ x: nx, y: H - 1, w: 3, h: nh }, 'hall');
  if (eng && neck) b.door(eng, neck);
  // The straps run the neck's length, stopping short of the weld so only the neck meets the host.
  fin(b, nx - 1, H, 1, nh - 2, 'strapW');
  fin(b, nx + 3, H, 1, nh - 2, 'strapE');
  return blockFrom(b, 'drive', 'pod 1E', 'human', [{ id: 's', side: 's', x: nx + 1, y: H + nh - 2, len: 1, access: 'human' }]);
}
