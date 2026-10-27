import type { Block } from './arranger';
import { blockFrom, localBuilder } from './blocks';
import type { Builder } from './builder';
import { roomy } from './civilBlocks';
import { engineSpec } from './plan';
import type { Rng } from '../rng';

/**
 * Improvised scrapper pieces, patched in for what no donor brought, each with an outline of its own rather than a
 * plain slab (their modules' art says what they are):
 *   patched reactor  the reactor room on a short off-centre access stub, a spare row
 *   strapped engine  an engine nacelle on a narrow access neck
 */

/** A patched-in reactor room (power the donors did not bring) on a short access stub. */
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
  return b;
}

/** A strapped-on engine: the engine room on a narrow access neck (its port). */
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
  return blockFrom(b, 'drive', 'pod 1E', 'human', [{ id: 's', side: 's', x: nx + 1, y: H + nh - 2, len: 1, access: 'human' }]);
}
