import { localBuilder } from './blocks';
import type { Builder, Part, Rect } from './builder';
import { dockSpec, type RoomSpec } from './plan';
import type { Rng } from '../rng';

/**
 * Straight-line station layouts on one local builder:
 *   spineStation  a long central spine (2 wide) with pods branching off both sides on short stubs, docks at its ends
 *   crossStation  four arms from a core room, rooms along both faces of each arm, docks at the arm ends
 */

/** A room `spec` on the `side` face of hall `p` at `along`, either flush (doored straight on) or on a stub `stub` long. */
function pod(b: Builder, p: Rect, side: 'n' | 's' | 'e' | 'w', spec: RoomSpec, along: number, stub: number): Part | null {
  if (stub <= 0) return b.attach(p, side, spec, along);
  const horiz = side === 'n' || side === 's';
  const W = (horiz ? spec.w : spec.h) + 2;
  // The stub stands under the room's middle.
  const off = along + (W >> 1) - 1;
  const L = stub + 2;
  const r: Rect = side === 'n' ? { x: p.x + off, y: p.y - L + 1, w: 3, h: L } : side === 's' ? { x: p.x + off, y: p.y + p.h - 1, w: 3, h: L }
    : side === 'w' ? { x: p.x - L + 1, y: p.y + off, w: L, h: 3 } : { x: p.x + p.w - 1, y: p.y + off, w: L, h: 3 };
  const s = b.place(r, 'hall');
  if (!s || !b.door(p, s)) return null;
  return b.attach(s, side, spec, -(W >> 1) + 1);
}

/** Rooms in a row along one face of a hall, from `start` tiles in, each on a stub of `stubs()` (0 = flush). */
function line(b: Builder, p: Rect, side: 'n' | 's' | 'e' | 'w', specs: RoomSpec[], start: number, stubs: () => number): RoomSpec[] {
  const horiz = side === 'n' || side === 's';
  const len = horiz ? p.w : p.h;
  const left: RoomSpec[] = [];
  let at = start;
  for (const r of specs) {
    const spec = horiz ? r : { ...r, w: r.h, h: r.w };
    const W = (horiz ? spec.w : spec.h) + 2;
    if (at + W > len - 1) { left.push(r); continue; }
    if (pod(b, p, side, spec, at, stubs())) at += W - 1;
    else left.push(r);
  }
  return left;
}

const half = (xs: RoomSpec[]): [RoomSpec[], RoomSpec[]] => [xs.filter((_, i) => i % 2 === 0), xs.filter((_, i) => i % 2 === 1)];
/** Length a row of rooms takes along a hall (neighbours share a wall). */
const runOf = (xs: RoomSpec[]): number => xs.reduce((t, r) => t + r.w + 1, 2);

export interface SpineOpts {
  /** Chance a pod stands on a stub rather than flush on the spine. */
  stubs: number;
  /** Longest stub. */
  reach: number;
}

/** Spine: a long 2-wide hall, the command room on it, pods both sides on stubs, a dock at each end. */
export function spineStation(rng: Rng, hub: RoomSpec, rooms: RoomSpec[], o: SpineOpts): Builder | null {
  const b = localBuilder(rng);
  // Docks go at the spine's two ends (airlocks face north or south), the rest of the docks among the pods.
  const docks = rooms.filter((r) => r.role === 'dock');
  const [n, s] = half([hub, ...rooms.filter((r) => r.role !== 'dock')]);
  docks.forEach((d, i) => {
    const list = i % 2 === 0 ? n : s;
    if (i < 2) list[i === 0 ? 'unshift' : 'push'](d);
    else list.splice(rng.int(0, list.length), 0, d);
  });
  const L = Math.max(runOf(n), runOf(s)) + 4;
  const spine = b.place({ x: -(L >> 1), y: -2, w: L, h: 4 }, 'hall');
  if (!spine) return null;
  const stubs = (): number => (rng.chance(o.stubs) ? rng.int(1, o.reach) : 0);
  if (line(b, spine, 'n', n, 2, stubs).length + line(b, spine, 's', s, 2, stubs).length > 0) return null;
  return b;
}

/** Cross: a square core room, four arms, rooms on both faces of every arm past the crossing, a dock at each arm end. */
export function crossStation(rng: Rng, hub: RoomSpec, rooms: RoomSpec[], stubChance: number): Builder | null {
  const b = localBuilder(rng);
  const C = Math.max(hub.w, hub.h, 5);
  const core = b.place({ x: -(C >> 1) - 1, y: -(C >> 1) - 1, w: C + 2, h: C + 2 }, hub.role, { ...hub, w: C, h: C });
  if (!core) return null;
  const docks = rooms.filter((r) => r.role === 'dock');
  const rest = rooms.filter((r) => r.role !== 'dock');
  // Rooms to the four arms, two faces each: deal round-robin to eight faces.
  const faces: RoomSpec[][] = Array.from({ length: 8 }, () => []);
  rest.forEach((r, i) => faces[i % 8]?.push(r));
  const depth = Math.max(3, ...rest.map((r) => Math.max(r.w, r.h))) + 2;
  const armLen = (k: number): number => Math.max(runOf(faces[2 * k] ?? []), runOf(faces[2 * k + 1] ?? [])) + depth + 8;
  const stubs = (): number => (rng.chance(stubChance) ? rng.int(1, 2) : 0);
  const cx = 0;
  const cy = 0;
  const arms: { r: Rect; sides: ['n' | 's' | 'e' | 'w', 'n' | 's' | 'e' | 'w']; end: 'n' | 's' | 'e' | 'w' }[] = [
    { r: { x: core.x + core.w - 1, y: cy - 1, w: armLen(0), h: 3 }, sides: ['n', 's'], end: 'e' },
    { r: { x: core.x - armLen(1) + 1, y: cy - 1, w: armLen(1), h: 3 }, sides: ['n', 's'], end: 'w' },
    { r: { x: cx - 1, y: core.y - armLen(2) + 1, w: 3, h: armLen(2) }, sides: ['w', 'e'], end: 'n' },
    { r: { x: cx - 1, y: core.y + core.h - 1, w: 3, h: armLen(3) }, sides: ['w', 'e'], end: 's' },
  ];
  for (const [k, a] of arms.entries()) {
    const p = b.place(a.r, 'hall');
    if (!p || !b.door(core, p)) return null;
    // Rooms start clear of the core and the crossing arms (from the far end for west and north arms).
    const outward = a.end === 'e' || a.end === 's';
    for (const [j, side] of a.sides.entries()) {
      const list = faces[2 * k + j] ?? [];
      // The last 6 tiles of every arm stay clear for its dock.
      const start = outward ? depth : 6;
      const len = (a.end === 'e' || a.end === 'w' ? p.w : p.h) - (outward ? 6 : depth);
      const sub = a.end === 'e' || a.end === 'w' ? { ...p, w: len } : { ...p, h: len };
      if (line(b, sub, side, list, start, stubs).length > 0) return null;
    }
    // A dock at each arm end: straight on for the north and south arms, on the north face at the end of the
    // east and west ones (airlocks face north or south).
    const d = docks[k] ?? (k < 2 ? dockSpec() : null);
    if (d && (a.end === 'n' || a.end === 's') && !b.attach(p, a.end, d, -1)) return null;
    if (d && (a.end === 'e' || a.end === 'w') && !b.attach(p, 'n', d, a.end === 'e' ? p.w - d.w - 3 : 1)) return null;
  }
  // Docks beyond four: on stubs off the arms.
  for (const [i, d] of docks.slice(4).entries()) {
    const a = arms[i % 2] as (typeof arms)[number];
    if (!b.attach(a.r, 's', d, a.end === 'e' ? a.r.w - d.w - 3 : 1)) return null;
  }
  return b;
}
