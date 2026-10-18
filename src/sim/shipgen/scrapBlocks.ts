import { localBuilder } from './blocks';
import type { Builder } from './builder';
import { cargoSpec, engineSpec, reactorSpec, type RoomSpec } from './plan';
import type { Rng } from '../rng';

/**
 * Hand-made salvage donors: civilian and one-off hulls only (navy and drone donors come from those factions' own
 * generators). Each is drawn on a local builder in its own construction style and frozen later (after any cut or
 * damage) with ports found from its outline:
 *   freighter  one huge open bay under a 2-wide gangway
 *   habitat    a 1-wide ring corridor round a hub room
 *   liner      a 1-wide spine lined with tiny identical cabins, a lounge bulb at one end
 *   station    a square module, a 1-wide cross corridor, a room in each quadrant
 *   barge      a catwalk over a row of deep hoppers stepping down in depth (a sawtooth keel)
 *   pod string cargo pods on a string of 1-tile tubes
 *   tug        a stubby hull with a reactor, an ore hopper and one big engine aft
 */

/** Salvaged reactor rooms are patched up around whatever doors the welds cut: a spare column and row. */
const roomy = (k: number): RoomSpec => ({ ...reactorSpec(k), w: 2 * k + 2, h: 4 });

const run = (specs: RoomSpec[]): number => specs.reduce((t, r) => t + r.w + 1, 1);

/** Civil bulk freighter: the bay under the gangway, shuttle bay and service rooms off the gangway's far side. */
export function freighter(rng: Rng, north: RoomSpec[], crates: number, south: RoomSpec[]): Builder | null {
  const b = localBuilder(rng);
  const bay: RoomSpec = { ...cargoSpec(crates), w: Math.max(6, Math.ceil(crates / 3) + 2), h: 5 };
  const W = Math.max(10, run(north), bay.w + 1 + run(south));
  const g = b.place({ x: 0, y: -2, w: W, h: 4 }, 'hall');
  const bx = g && b.place({ x: 0, y: 1, w: bay.w + 2, h: bay.h + 2 }, 'cargo', bay);
  if (!g || !bx) return null;
  b.door(g, bx, 'low');
  b.strip(g, 'n', north, 0);
  b.strip(g, 's', south, bay.w + 1);
  return b;
}

/** Civil habitat: a ring corridor round a hub room, cabins and airlocks outboard of the ring. */
export function habitat(rng: Rng, hub: RoomSpec, top: RoomSpec[], bottom: RoomSpec[]): Builder | null {
  const b = localBuilder(rng);
  const W = Math.max(hub.w + 6, run(top) + 4, run(bottom) + 4, 10);
  const th = b.place({ x: 2, y: -5, w: W - 4, h: 3 }, 'hall');
  const hb = b.place({ x: 2, y: -3, w: W - 4, h: 6 }, hub.role, hub);
  const bh = b.place({ x: 2, y: 2, w: W - 4, h: 3 }, 'hall');
  const cw = b.place({ x: 0, y: -5, w: 3, h: 10 }, 'hall');
  const ce = b.place({ x: W - 3, y: -5, w: 3, h: 10 }, 'hall');
  if (!th || !hb || !bh || !cw || !ce) return null;
  for (const [a, c] of [[cw, th], [cw, bh], [ce, th], [ce, bh], [th, hb]] as const) b.door(a, c);
  b.strip(th, 'n', top, 2);
  b.strip(bh, 's', bottom, 2);
  return b;
}

/** Passenger liner segment: one-bed cabins both sides of a 1-wide spine, the lounge (life support) at the west end. */
export function liner(rng: Rng, beds: number, lounge: RoomSpec): Builder | null {
  const b = localBuilder(rng);
  const cabins = Array.from({ length: beds }, (): RoomSpec => ({ role: 'quarters', mods: ['module.bed'], w: 2, h: 2 }));
  const n = cabins.slice(0, Math.ceil(beds / 2));
  const s = cabins.slice(n.length);
  const lw = Math.max(3, lounge.w);
  const lo = b.place({ x: 0, y: -5, w: lw + 2, h: 9 }, lounge.role, { ...lounge, w: lw, h: 7 });
  const sp = b.place({ x: lw + 1, y: -2, w: Math.max(run(n), run(s)) + 1, h: 3 }, 'hall');
  if (!lo || !sp) return null;
  b.door(lo, sp);
  b.strip(sp, 'n', n, lw + 1);
  b.strip(sp, 's', s, lw + 1);
  return b;
}

/** Station module: a square of quadrant rooms round a 1-wide cross corridor open on all four faces. */
export function station(rng: Rng, rooms: RoomSpec[]): Builder | null {
  const b = localBuilder(rng);
  const Q = Math.max(3, ...rooms.map((r) => Math.max(r.w, r.h)));
  const hz = b.place({ x: 0, y: Q + 1, w: 2 * Q + 5, h: 3 }, 'hall');
  const na = b.place({ x: Q + 1, y: 0, w: 3, h: Q + 2 }, 'hall');
  const sa = b.place({ x: Q + 1, y: Q + 3, w: 3, h: Q + 2 }, 'hall');
  if (!hz || !na || !sa) return null;
  b.door(na, hz);
  b.door(sa, hz);
  const quad = [{ x: 0, y: 0, arm: na }, { x: Q + 3, y: 0, arm: na }, { x: 0, y: Q + 3, arm: sa }, { x: Q + 3, y: Q + 3, arm: sa }];
  for (let i = 0; i < Math.min(4, rooms.length); i++) {
    const q = quad[i] as (typeof quad)[number];
    const r = rooms[i] as RoomSpec;
    const p = b.place({ x: q.x, y: q.y, w: Q + 2, h: Q + 2 }, r.role, { ...r, w: Q, h: Q });
    if (!p || (!b.door(q.arm, p) && !b.door(hz, p))) return null;
  }
  return b;
}

/** Ore barge: a catwalk over a row of deep hoppers, each no deeper than the last (the sawtooth keel). */
export function barge(rng: Rng, crates: number): Builder | null {
  const b = localBuilder(rng);
  const k = Math.max(2, Math.min(4, Math.ceil(crates / 4)));
  let d = rng.int(5, 6);
  let left = crates;
  const hoppers: RoomSpec[] = [];
  for (let i = 0; i < k; i++) {
    const n = Math.max(1, Math.ceil(left / (k - i)));
    left -= n;
    hoppers.push({ ...cargoSpec(n), w: 4, h: d });
    d = Math.max(3, d - rng.int(0, 1));
  }
  const cw = b.place({ x: 0, y: -2, w: run(hoppers), h: 3 }, 'hall');
  if (!cw) return null;
  b.strip(cw, 's', hoppers, 0);
  return b;
}

/** Cargo pod string: pods on a string of 1-tile tubes. */
export function podString(rng: Rng, crates: number): Builder | null {
  const b = localBuilder(rng);
  const k = Math.max(2, Math.min(4, Math.ceil(crates / 4)));
  let left = crates;
  let tube: ReturnType<Builder['place']> = null;
  for (let i = 0; i < k; i++) {
    const n = Math.max(1, Math.ceil(left / (k - i)));
    left -= n;
    const pod = b.place({ x: 6 * i, y: -3, w: 5, h: 5 }, 'cargo', { ...cargoSpec(n), w: 3, h: 3 });
    if (!pod || (tube && !b.door(tube, pod))) return null;
    if (i === k - 1) break;
    tube = b.place({ x: 6 * i + 4, y: -2, w: 3, h: 3 }, 'hall');
    if (!tube || !b.door(pod, tube)) return null;
  }
  return b;
}

/** Mining tug: a stubby hull with an ore hopper, a reactor and one big engine aft. */
export function tug(rng: Rng, hopper: RoomSpec, reactors: number): Builder | null {
  const b = localBuilder(rng);
  const r = roomy(Math.max(1, reactors));
  const L = Math.max(r.w, hopper.w) + 3;
  const h = b.place({ x: 0, y: -2, w: L + 2, h: 4 }, 'hall');
  if (!h) return null;
  b.strip(h, 'n', [r], 1);
  b.strip(h, 's', [{ ...hopper, h: Math.max(3, hopper.h) }], 1);
  const e = engineSpec(1, 'w');
  const eng = b.place({ x: L + 1, y: -3, w: e.w + 2, h: e.h + 2 }, 'engine', e);
  if (!eng || !b.door(h, eng)) return null;
  return b;
}

/** A patched-in reactor room (power the donors did not bring) on a short access passage. */
export function reactorRoom(rng: Rng, k: number): Builder | null {
  const b = localBuilder(rng);
  const r = roomy(k);
  const room = b.place({ x: 0, y: -4, w: r.w + 2, h: r.h + 2 }, 'reactor', r);
  const pass = b.place({ x: 0, y: 1, w: r.w + 2, h: 3 }, 'hall');
  if (!room || !pass || !b.door(room, pass)) return null;
  return b;
}
