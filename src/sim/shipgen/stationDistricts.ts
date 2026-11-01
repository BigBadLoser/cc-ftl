import type { RoomSpec } from './plan';
import type { RoomRole } from './types';

/**
 * Districts placed by design on round stations (rings round a hub, docks banked on the north and south faces).
 * Instead of one list wrapped round the circle, each room has a pull towards the docks:
 *   - the armoury stands at the dock as the customs post, then cargo and the open trade rooms;
 *   - works rooms sit between;
 *   - messes and the living rooms are quiet, and quarters are quietest.
 * On a ring cut into arcs by the dock banks, each arc runs from one bank to the other, so its rooms are laid out
 * "organ pipe" fashion: the strongest pull at both ends (beside the banks), the quietest in the middle (the flanks).
 * Concentric stations also send the quiet rooms to the inner rings, away from the docks entirely.
 */

/** Pull towards the docks: high stands beside a bank, low stays far from it. */
const PULL: Partial<Record<RoomRole, number>> = {
  bridge: 5, armoury: 4, cargo: 3, hangar: 3, plaza: 3, industry: 2, farm: 1, drill: 0, garden: -1, support: -1, quarters: -2,
};
export const pullOf = (r: RoomSpec): number => PULL[r.role] ?? 0;

const area = (r: RoomSpec): number => r.w * r.h + 4;

/** Rooms in order of pull, strongest first; ties keep the given order (a stable sort keeps the zoned order inside a district). */
export const byPull = (rooms: readonly RoomSpec[]): RoomSpec[] => [...rooms].sort((a, b) => pullOf(b) - pullOf(a));

/**
 * Share `rooms` out to arcs (weights: their lengths) and lay each arc out organ-pipe fashion: strongest pull at both
 * ends, quietest in the middle. The strongest rooms are dealt round the arcs first, so every bank gets its share of
 * customs and cargo.
 */
export function organPipes(rooms: readonly RoomSpec[], lengths: readonly number[], first = 0): RoomSpec[][] {
  const total = lengths.reduce((t, l) => t + l, 0) || 1;
  const sum = rooms.reduce((t, r) => t + area(r), 0);
  const groups: RoomSpec[][] = lengths.map(() => []);
  const load = lengths.map(() => 0);
  // Each room to the arc furthest below its share (by area); short arcs that can hold nothing get nothing.
  for (const [n, r] of byPull(rooms).entries()) {
    // The strongest room (the bridge's office, else the customs post) opens arc `first`: beside the main bank.
    let best = n === 0 ? first : 0, gap = n === 0 ? Infinity : -Infinity;
    for (let i = 0; i < lengths.length; i++) {
      const g = ((lengths[i] as number) / total) * sum - (load[i] as number);
      if (g > gap) { gap = g; best = i; }
    }
    (groups[best] as RoomSpec[]).push(r);
    load[best] = (load[best] as number) + area(r);
  }
  return groups.map((g) => {
    // Strongest first: alternate the two ends, so the middle is left to the quietest.
    const head: RoomSpec[] = [], tail: RoomSpec[] = [];
    // Rooms that want the docks door towards their bank (the arc end they stand at).
    g.forEach((r, i) => (i % 2 === 0 ? head : tail).push(pullOf(r) > 0 ? { ...r, doorLean: i % 2 === 0 ? -1 : 1 } : r));
    return [...head, ...tail.reverse()];
  });
}

/**
 * Concentric bands by district: the quietest rooms round the hub (the inner ring's inboard band), then the inner ring's
 * outboard band, the rest (the dock district) on the outer ring. Shares by floor area as before (about a fifth and a
 * third), filled from the quiet end.
 */
export function concentricBands(rest: readonly RoomSpec[]): { iIn: RoomSpec[]; iOut: RoomSpec[]; oBand: RoomSpec[] } {
  const total = rest.reduce((t, r) => t + r.w * r.h, 0);
  const iIn: RoomSpec[] = [], iOut: RoomSpec[] = [], oBand: RoomSpec[] = [];
  let a = 0;
  for (const r of byPull(rest).reverse()) {
    (a < total * 0.2 ? iIn : a < total * 0.53 ? iOut : oBand).push(r);
    a += r.w * r.h;
  }
  return { iIn, iOut, oBand };
}

/**
 * Concentric bands round a market (trading): the inner ring is the market ring round the rotunda, shops and the commons
 * (messes, lounges) on both faces; the outer ring is home, the harbour and habitation. Shops are added (one a quarters
 * room, two at least), decorative units like the market street's.
 */
export function marketBands(rest: readonly RoomSpec[]): { iIn: RoomSpec[]; iOut: RoomSpec[]; oBand: RoomSpec[] } {
  const commons = rest.filter((r) => r.role === 'support' || r.role === 'plaza' || r.role === 'garden');
  const shops: RoomSpec[] = Array.from({ length: Math.max(6, 3 * rest.filter((r) => r.role === 'quarters').length) }, () => ({ role: 'shop', mods: [], w: 4, h: 4, dept: 'commons' }));
  const ring = [...shops, ...commons];
  const iIn: RoomSpec[] = [], iOut: RoomSpec[] = [];
  // About two fifths round the rotunda, the rest outboard; shops spread through both.
  ring.forEach((r, i) => ((i % 5) < 2 ? iIn : iOut).push(r));
  return { iIn, iOut, oBand: rest.filter((r) => !commons.includes(r)) };
}
