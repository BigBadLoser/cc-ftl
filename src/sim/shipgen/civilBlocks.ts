import { localBuilder } from './blocks';
import type { Builder, Rect, Side } from './builder';
import { cargoSpec, engineSpec, reactorSpec, type RoomSpec } from './plan';
import type { Rng } from '../rng';
import { containerChar } from './containerCells';

/**
 * Civilian builders, shared by the civilian generator and by scrapper salvage (as donors). Each draws one civil
 * section on a local builder in its own construction style; callers freeze it (after any salvage cut or damage)
 * with ports found from its outline:
 *   freighter  one huge open bay under a 2-wide gangway
 *   habitat    a 1-wide ring corridor round a hub room
 *   liner      a 1-wide spine lined with tiny identical cabins, a lounge bulb at one end
 *   station    a square module, a 1-wide cross corridor, a room in each quadrant
 *   barge      a catwalk over a row of deep hoppers stepping down in depth (a sawtooth keel)
 *   pod string sealed containers clamped along a crawl tube
 *   tug        a stubby hull with a reactor, an ore hopper and one big engine aft
 *   containers cargo containers strung along a 1-wide spine, gaps between them
 *   cockpit    a blunt bridge room on a short corridor stub
 *   drive      a light civil drive: reactors either side of a short spine, engines aft (nozzle, pair or nacelles)
 *   cabins     a cabin row: one-bed cabins both sides of a 1-wide spine
 *   lounge     a lounge band: public rooms either side of a through corridor (a blister when one-sided)
 *   cross hub  a plus: the bridge at the crossing of two corridors, rooms out along the arms
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
export function liner(rng: Rng, beds: number, lounge: RoomSpec, cabin: [number, number] = [2, 2], bulb = 7): Builder | null {
  const b = localBuilder(rng);
  // Cabins of `cabin` size (one bed each), the lounge bulb `bulb` tiles deep (it stands proud of the cabin rows).
  const cabins = Array.from({ length: beds }, (): RoomSpec => ({ role: 'quarters', mods: ['module.bed'], w: cabin[0], h: cabin[1] }));
  const n = cabins.slice(0, Math.ceil(beds / 2));
  const s = cabins.slice(n.length);
  const lw = Math.max(3, lounge.w);
  const hb = Math.max(3, bulb);
  const lo = b.place({ x: 0, y: -1 - Math.ceil(hb / 2) - 1, w: lw + 2, h: hb + 2 }, lounge.role, { ...lounge, w: lw, h: hb });
  const sp = b.place({ x: lw + 1, y: -2, w: Math.max(run(n), run(s)) + 1, h: 3 }, 'hall');
  if (!lo || !sp || !b.door(lo, sp)) return null;
  b.strip(sp, 'n', n, lw + 1);
  b.strip(sp, 's', s, lw + 1);
  return b;
}

/**
 * Station module: a square of quadrant rooms round a 1-wide cross corridor open on all four faces. Each quadrant is as
 * big as the group's largest room; with `fit`, each room keeps its own size (at least 3 a side), tucked into its
 * quadrant's corner by the cross, the rest of the quadrant left open (a core grouped with a big hold is not a hold-sized
 * box with one machine in it).
 */
export function station(rng: Rng, rooms: RoomSpec[], fit = false): Builder | null {
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
    // A gun bay keeps 5 a side (its gun needs the hull and a clear ring round its turret).
    const least = r.role === 'weapons' ? 5 : 3;
    const w = fit ? Math.min(Q, Math.max(least, r.w)) : Q;
    const h = fit ? Math.min(Q, Math.max(least, r.h)) : Q;
    // The corner nearest the cross: right of a west quadrant, left of an east one; bottom of a north one, top of a south.
    const x = q.x === 0 ? Q - w : q.x;
    const y = q.y === 0 ? Q - h : q.y;
    const p = b.place({ x, y, w: w + 2, h: h + 2 }, r.role, { ...r, w, h });
    if (!p || (!b.door(q.arm, p) && !b.door(hz, p))) return null;
  }
  return b;
}

/** Ore barge: a catwalk over a row of deep hoppers, each no deeper than the last (the sawtooth keel). */
export function barge(rng: Rng, crates: number, count?: number): Builder | null {
  const b = localBuilder(rng);
  const k = count ?? Math.max(2, Math.min(4, Math.ceil(crates / 4)));
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

/** Container footprints a pod string draws from: the short (door) end along the tube, the length off it. */
const STRING_BOXES: readonly (readonly [number, number])[] = [[3, 6], [2, 4]];

/**
 * Cargo pod string: sealed containers clamped along both walls of a crawl tube (crew walk the tube to whatever lies
 * beyond it; the containers are not rooms). Tidy (civil): one container size, even spacing. `scrappy` (scrapper
 * salvage): mismatched sizes, irregular gaps, empty slots.
 */
export function podString(rng: Rng, crates: number, scrappy = false): Builder | null {
  const b = localBuilder(rng);
  const k = Math.max(4, Math.min(9, Math.ceil(crates / 2))) + (scrappy ? rng.int(0, 2) : 0);
  const base = rng.pick(STRING_BOXES);
  const gap = rng.int(0, 1);
  // Lay each side's containers out along the tube first, then size the tube to the longer side.
  const sides: { x: number; w: number; d: number }[][] = [[], []];
  // The tube's walls stay bare for a stretch at both ends: its n / s faces are where it welds on.
  const ends = [3, 3 + (scrappy ? rng.int(0, 2) : 0)];
  for (let i = 0; i < k; i++) {
    const s = i % 2;
    const [w, d] = scrappy ? rng.pick(STRING_BOXES) : base;
    if (scrappy && i > 1 && rng.chance(0.25)) ends[s] = (ends[s] as number) + w + 1; // an empty slot
    else {
      sides[s]?.push({ x: ends[s] as number, w, d });
      ends[s] = (ends[s] as number) + w + (scrappy ? rng.int(0, 3) : gap);
    }
  }
  const L = Math.max(8, ...ends) + 3;
  const tube = b.place({ x: 0, y: -2, w: L, h: 3 }, 'hall');
  if (!tube) return null;
  for (const [s, row] of sides.entries()) {
    for (const c of row) {
      const ch = containerChar(c.w, c.d);
      if (!ch) continue;
      b.cv.stamp(Array.from({ length: c.d }, () => ch.repeat(c.w)), c.x, s === 0 ? -2 - c.d : 1, `box${s}.${c.x}`);
    }
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

/** Container spine: identical cargo containers both sides of a 1-wide spine, a tile of spine showing between them. */
export function containers(rng: Rng, crates: number, size: number, gap: number, stagger = 0): Builder | null {
  const b = localBuilder(rng);
  // A container holds a couple of crates per row of its depth, with a walkway: many small units on the spine.
  const per = Math.max(2, 2 * (size - 1));
  const k = Math.max(2, Math.ceil(crates / per));
  const left: RoomSpec[] = [];
  for (let i = 0, rest = crates; i < k; i++) {
    const n = Math.max(1, Math.ceil(rest / (k - i)));
    rest -= n;
    left.push({ ...cargoSpec(n), w: size, h: size });
  }
  const n = left.filter((_, i) => i % 2 === 0);
  const s = left.filter((_, i) => i % 2 === 1);
  const len = Math.max(n.length, s.length) * (size + 1 + gap) + gap + 1 + stagger;
  const sp = b.place({ x: 0, y: -2, w: len + 2, h: 3 }, 'hall');
  if (!sp) return null;
  b.strip(sp, 'n', n, 1 + gap, { gap: () => gap });
  // `stagger`: the lower row offset along the spine (staggered stacking) instead of matched pairs.
  b.strip(sp, 's', s, 1 + gap + stagger, { gap: () => gap });
  return b;
}

/** A blunt civil bridge: the command room with a short corridor stub aft (and any extra rooms beside the stub). */
export function cockpit(rng: Rng, command: RoomSpec, beside: RoomSpec[]): Builder | null {
  const b = localBuilder(rng);
  const h = command.h;
  const room = b.place({ x: 0, y: -1 - Math.ceil(h / 2), w: command.w + 2, h: h + 2 }, 'bridge', command);
  const half = (k: number): number => beside.filter((_, i) => i % 2 === k).reduce((t, r) => t + r.w + 1, 1);
  const L = Math.max(3, half(0), half(1));
  const stub = room && b.place({ x: command.w + 1, y: -2, w: L + 2, h: 3 }, 'hall');
  if (!room || !stub || !b.door(room, stub)) return null;
  b.strip(stub, 'n', beside.filter((_, i) => i % 2 === 0), command.w + 1);
  b.strip(stub, 's', beside.filter((_, i) => i % 2 === 1), command.w + 1);
  return b;
}

export type DriveStyle = 'nozzle' | 'pair' | 'nacelles';

/** Make the specs of both sides run the same length (the shorter side's first room widens). */
function level(a: RoomSpec[], b: RoomSpec[]): void {
  const d = run(a) - run(b);
  const short = d > 0 ? b : a;
  if (d !== 0 && short[0]) short[0] = { ...short[0], w: short[0].w + Math.abs(d) };
}

/**
 * Light civil drive, never the navy's tall transverse bank: the reactors either side of a short spine, the engines
 * at its end. `nozzle` one engine room holding every engine; `pair` two engine rooms stacked on a short rail;
 * `nacelles` two engine rooms out on the rail's ends with open space between them. One engine is always a nozzle.
 */
export function drive(rng: Rng, engines: number, reactors: number, style: DriveStyle): Builder | null {
  const b = localBuilder(rng);
  const E = Math.max(1, engines);
  const n: RoomSpec[] = reactors > 0 ? [reactorSpec(Math.ceil(reactors / 2))] : [];
  const s: RoomSpec[] = reactors > 1 ? [reactorSpec(Math.floor(reactors / 2))] : [];
  if (n.length > 0 && s.length > 0) level(n, s);
  const W = Math.max(4, run(n), run(s)) + rng.int(0, 2);
  const sp = b.place({ x: 0, y: -2, w: W, h: 3 }, 'hall');
  if (!sp) return null;
  b.strip(sp, 'n', n, 0);
  b.strip(sp, 's', s, 0);
  if (style === 'nozzle' || E < 2) {
    const e = engineSpec(E, 'w');
    const eng = b.place({ x: W - 1, y: -2 - Math.floor((e.h - 1) / 2), w: e.w + 2, h: e.h + 2 }, 'engine', e);
    return eng && b.door(sp, eng) ? b : null;
  }
  // Two engine rooms on a rail: stacked (gap -1, a shared wall) or nacelles with open rows between.
  const gap = style === 'pair' ? -1 : rng.int(1, 3);
  const top = engineSpec(Math.ceil(E / 2), 'w');
  const bot = engineSpec(Math.floor(E / 2), 'w');
  const nb = -1 - Math.ceil(gap / 2);
  const a = nb - top.h - 1;
  const sb = nb + gap + 1;
  const rail = b.place({ x: W - 1, y: a, w: 3, h: sb + bot.h + 2 - a }, 'hall');
  const en = b.place({ x: W + 1, y: a, w: top.w + 2, h: top.h + 2 }, 'engine', top);
  const es = b.place({ x: W + 1, y: sb, w: bot.w + 2, h: bot.h + 2 }, 'engine', bot);
  if (!rail || !en || !es || !b.door(sp, rail) || !b.door(rail, en) || !b.door(rail, es)) return null;
  return b;
}

/** A cabin row: one-bed cabins of `cabin` size both sides of a 1-wide spine. */
export function cabins(rng: Rng, beds: number, cabin: [number, number]): Builder | null {
  const b = localBuilder(rng);
  const all = Array.from({ length: Math.max(2, beds) }, (): RoomSpec => ({ role: 'quarters', mods: ['module.bed'], w: cabin[0], h: cabin[1] }));
  const n = all.slice(0, Math.ceil(all.length / 2));
  const s = all.slice(n.length);
  const sp = b.place({ x: 0, y: -2, w: Math.max(run(n), run(s)) + 2, h: 3 }, 'hall');
  if (!sp) return null;
  b.strip(sp, 'n', n, 1);
  b.strip(sp, 's', s, 1);
  return b;
}

/** A lounge band: public rooms either side of a through corridor, `depth` deep; one-sided, a blister. */
export function lounge(rng: Rng, rooms: RoomSpec[], depth: number, oneSided = false): Builder | null {
  const b = localBuilder(rng);
  const fit = rooms.map((r) => ({ ...r, w: Math.max(r.w, 3), h: Math.max(depth, 2) }));
  const n = oneSided ? fit : fit.filter((_, i) => i % 2 === 0);
  const s = oneSided ? [] : fit.filter((_, i) => i % 2 === 1);
  const sp = b.place({ x: 0, y: -2, w: Math.max(5, run(n), run(s)) + 2, h: 3 }, 'hall');
  if (!sp) return null;
  b.strip(sp, 'n', n, 1);
  b.strip(sp, 's', s, 1);
  return b;
}

/** Cross hub: the bridge at the crossing of two corridors, the other rooms out along the arms (two per arm). */
export function crossHub(rng: Rng, centre: RoomSpec, rooms: RoomSpec[], armIn: number): Builder | null {
  const b = localBuilder(rng);
  const arm = Math.max(4, armIn);
  const C = Math.max(centre.w, centre.h);
  const half = Math.floor(C / 2);
  const mid = b.place({ x: -half - 1, y: -half - 2, w: C + 2, h: C + 2 }, centre.role, { ...centre, w: C, h: C });
  if (!mid) return null;
  const cy = mid.y + Math.floor(mid.h / 2);
  const cx = mid.x + Math.floor(mid.w / 2);
  const arms = {
    w: b.place({ x: mid.x - arm - 1, y: cy - 1, w: arm + 2, h: 3 }, 'hall'),
    e: b.place({ x: mid.x + mid.w - 1, y: cy - 1, w: arm + 2, h: 3 }, 'hall'),
    n: b.place({ x: cx - 1, y: mid.y - arm - 1, w: 3, h: arm + 2 }, 'hall'),
    s: b.place({ x: cx - 1, y: mid.y + mid.h - 1, w: 3, h: arm + 2 }, 'hall'),
  };
  for (const a of Object.values(arms)) if (!a || !b.door(mid, a)) return null;
  // Rooms flank the arms next to the crossing: east-west arms first, then the north-south ones (mirror-symmetric).
  const order: ['w' | 'e' | 'n' | 's', Side][] = [['w', 'n'], ['e', 'n'], ['w', 's'], ['e', 's'], ['n', 'w'], ['n', 'e'], ['s', 'w'], ['s', 'e']];
  for (let i = 0; i < Math.min(order.length, rooms.length); i++) {
    const [k, side] = order[i] as ['w' | 'e' | 'n' | 's', Side];
    const a = arms[k] as Rect;
    const len = k === 'w' || k === 'e' ? a.w : a.h;
    const r = rooms[i] as RoomSpec;
    const d = Math.max(4, Math.min(Math.max(r.w, r.h), len - 2));
    const along = k === 'w' || k === 'n' ? len - d - 2 : 0;
    if (!b.attach(a, side, { ...r, w: d, h: d }, Math.max(0, along))) return null;
  }
  return b;
}

/** A bridge tower: a vertical shaft with rooms stacked either side of it, entered at its foot (an outboard superstructure). */
export function tower(rng: Rng, rooms: RoomSpec[]): Builder | null {
  const b = localBuilder(rng);
  const w = rooms.filter((_, i) => i % 2 === 0);
  const e = rooms.filter((_, i) => i % 2 === 1);
  const along = (s: RoomSpec[]): number => s.reduce((t, r) => t + r.h + 1, 1);
  const H = Math.max(along(w), along(e), 5);
  const shaft = b.place({ x: 0, y: -H, w: 3, h: H + 1 }, 'hall');
  if (!shaft) return null;
  for (const [side, list] of [['w', w], ['e', e]] as const) {
    let y = 0;
    for (const r of list) {
      if (!b.attach(shaft, side, r, y)) return null;
      y += r.h + 1;
    }
  }
  return b;
}
