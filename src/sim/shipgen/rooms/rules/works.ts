/**
 * Work rooms (furnishing mock round 2, tools/shipgen/mocks/furnishingRooms.ts): the workshop, the breaker shop, the
 * laboratory and the suit-up room. Room frame of parts.ts: (0, 0) the top-left floor tile, the door under the bottom
 * wall at column d. Corner pieces that would stand on the door's column are left out.
 */
import type { Piece } from './check';
import { BE, CD, CN, FB, L, OB, PL, PT, RF, RK, RS, SB, SP, P, count, range } from './parts';
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

/**
 * RF slot columns: where n refineries stand along the back wall, each four wide (its three and its working tile's
 * column), none over the tiles inside the room's other doors, spread as evenly as the room allows; null when they do not fit.
 */
export function rfSlots(w: number, n: number, doors: readonly { x: number; y: number }[] = []): number[] | null {
  let best: number[] | null = null, bestGap = -1;
  const pick = (from: number, got: number[]): void => {
    if (got.length === n) {
      const edges = [got[0] as number, ...got.slice(1).map((x, i) => x - (got[i] as number) - 4), w - (got[n - 1] as number) - 4];
      const gap = Math.min(...edges);
      if (gap > bestGap) { bestGap = gap; best = [...got]; }
      return;
    }
    for (let x = from; x + 4 * (n - got.length) <= w; x++) {
      if (doors.some((t) => t.y <= 5 && t.x >= x && t.x <= x + 2)) continue;
      pick(x + 4, [...got, x]);
    }
  };
  pick(0, []);
  return best;
}

/**
 * RF: the refineries along the back wall, each with its ore bin flush under it (its feed), the working tile at the
 * refinery's foot beside the bin and a row of floor below the bins kept clear; spread evenly, clear of any door in the
 * room's other doors. Needs seven rows: four of refinery, two of bin, one to walk.
 */
export function rf(c: Ctx): Piece[] {
  const xs = rfSlots(c.w, Math.max(1, count(c.need, RF)), c.doors) ?? [];
  return xs.flatMap((x) => [P(RF, x, 0, 0), P(OB, x, 4, 0)]);
}

/** RF2 slots: refinery-and-bin pairs (five wide, four deep) a room holds, in rows five tiles apart from the back wall. */
export const rf2Fits = (w: number, h: number): number => Math.floor(w / 5) * (h >= 5 ? Math.floor((h - 5) / 5) + 1 : 0);

/**
 * RF2, for a deep narrow room: the refineries in rows from the back wall, each with its ore bin flush beside it (the
 * bin at its shoulder, the working tile below the bin), a row of floor under each row of them; rows centred, and any
 * pair over the tiles inside another door left out (the rule then does not fit, and the room is tried another way).
 */
export function rf2(c: Ctx): Piece[] {
  const n = Math.max(1, count(c.need, RF)), per = Math.max(1, Math.floor(c.w / 5)), out: Piece[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / per), inRow = Math.min(per, n - row * per), gap = Math.floor((c.w - 5 * inRow) / (inRow + 1));
    const x = gap + (i % per) * (5 + gap), y = 5 * row;
    if ((c.doors ?? []).some((t) => t.y >= y && t.y <= y + 4 && t.x >= x && t.x <= x + 4)) return [];
    out.push(P(RF, x, y, 0), P(OB, x + 3, y, 0));
  }
  return out;
}
