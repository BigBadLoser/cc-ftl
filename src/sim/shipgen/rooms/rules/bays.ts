/**
 * Care and bay rooms (furnishing mock round 2, tools/shipgen/mocks/furnishingRooms.ts): the trauma room and the drone
 * bay. Room frame of parts.ts: (0, 0) the top-left floor tile, the door under the bottom wall at column d.
 */
import type { Piece } from './check';
import { DR, MB, P, RP, count, range } from './parts';
import type { Ctx } from './rules';

/** TR: the recovery pod in the back corner, the cots standing on end along the back wall from the far corner, a tile between. */
export function tr(c: Ctx): Piece[] {
  return [P(RP, 0, 0, 0), ...range(0, count(c.need, MB) - 1, 1).map((i) => P(MB, c.w - 1 - 2 * i, 0, 0))];
}

/** Whether the pod and every planned cot fit along the back wall (the pod two wide, a tile clear of it). */
export const traumaFits = (need: readonly string[], w: number): boolean => count(need, MB) >= 1 && w >= 2 * count(need, MB) + 2;

/** DB: the bays a row down from the back wall, spread edge to edge with a tile off each side where the room is wide enough. */
export function db(c: Ctx): Piece[] {
  const { w } = c, n = count(c.need, DR), m = w >= 2 * n + 2 ? 1 : 0;
  const xs = n === 1 ? [Math.floor((w - 2) / 2)] : range(0, n - 1, 1).map((i) => m + Math.round((i * (w - 2 * m - 2)) / (n - 1)));
  return xs.map((x) => P(DR, x, 1, 0));
}
