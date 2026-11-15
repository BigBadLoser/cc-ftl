/**
 * Work rooms (furnishing mock round 2, tools/shipgen/mocks/furnishingRooms.ts): the workshop, the breaker shop, the
 * laboratory and the suit-up room. Room frame of parts.ts: (0, 0) the top-left floor tile, the door under the bottom
 * wall at column d. Corner pieces that would stand on the door's column are left out.
 */
import type { Piece } from './check';
import { BE, CD, CN, FB, L, PL, PT, RK, RS, SB, SP, P, count, range } from './parts';
import type { Ctx } from './rules';

/** Whether a two-wide piece at x leaves the door's column free. */
const clear = (x: number, d: number, w = 2): boolean => d < x || d >= x + w;
/** A cargo pallet in each bottom corner the door's column does not run through. */
const pallets = (c: Ctx): Piece[] => [0, c.w - 2].filter((x) => clear(x, c.d)).map((x) => P(PT, x, c.h - 2, 2));

/** WS: racks in the back corners, the fabricators spread evenly between them, a pallet in each bottom corner of a deep room. */
export function ws(c: Ctx): Piece[] {
  const { w, h } = c, n = Math.max(1, count(c.need, FB)), gap = Math.floor((w - 4 - 2 * n) / (n + 1));
  return [P(RK, 0, 0, 0), P(RK, w - 2, 0, 0), ...range(0, n - 1, 1).map((i) => P(FB, 2 + gap + i * (2 + gap), 0, 0)), ...(h >= 5 ? pallets(c) : [])];
}

/** BK: a scrap bin in each back corner, the scrapper between them, a pallet in each bottom corner. */
export function bk(c: Ctx): Piece[] {
  const { w } = c;
  return [P(SB, 0, 0, 0), P(SB, w - 2, 0, 0), P(SP, Math.floor((w - 4) / 2), 0, 0), ...pallets(c)];
}

/**
 * LB: research modules along the back wall (the corners for two, spread edge to edge for more, centred for one), the
 * planned consoles in the gap between two; a cold store and a planter in the bottom corners with the planned lockers
 * between them and the door.
 */
export function lb(c: Ctx): Piece[] {
  const { w, h, d } = c, n = Math.max(1, count(c.need, RS)), cons = count(c.need, CN), lockers = count(c.need, L);
  const xs = n === 1 ? [Math.floor((w - 3) / 2)] : range(0, n - 1, 1).map((i) => Math.round((i * (w - 3)) / (n - 1)));
  const gap = n === 2 ? w - 6 : 0, from = 3 + Math.floor((gap - (2 * cons - 1)) / 2);
  const consoles = cons > 0 && n === 2 && 2 * cons - 1 <= gap ? range(0, cons - 1, 1).map((i) => P(CN, from + 2 * i, 0, 0)) : [];
  const slots = [...range(2, d - 1, 1), ...range(w - 2, d + 1, -1)];
  const shelved = lockers > 0 && lockers <= slots.length ? slots.slice(0, lockers).map((x) => P(L, x, h - 1, 2)) : [];
  return [
    ...xs.map((x) => P(RS, x, 0, 0)), ...consoles, ...shelved,
    ...(clear(0, d) ? [P(CD, 0, h - 1, 2)] : []), ...(d < w - 1 ? [P(PL, w - 1, h - 1, 2)] : []),
  ];
}

/** SU: lockers along the back wall, the planned ones only (edges first), a gap over the door's column where they all still fit; a bench in each bottom corner. */
export function su(c: Ctx): Piece[] {
  const { w, h, d } = c, want = count(c.need, L), cols = range(0, w - 1, 1);
  const open = want <= w - 1 ? cols.filter((x) => x !== d) : cols;
  const xs = (want > 0 ? [...open].sort((a, b) => Math.min(a, w - 1 - a) - Math.min(b, w - 1 - b) || a - b).slice(0, want) : open).sort((a, b) => a - b);
  const benches = h >= 3 && w >= 6 ? [0, w - 2].filter((x) => clear(x, d)).map((x) => P(BE, x, h - 1, 2)) : [];
  return [...xs.map((x) => P(L, x, 0, 0)), ...benches];
}
