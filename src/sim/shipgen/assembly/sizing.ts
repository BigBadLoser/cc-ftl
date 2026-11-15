import type { RoomSpec } from '../plan';
import { isBarracks } from './quarters';

/**
 * How far a station room may grow past its planned floor, as a multiple of it: the one answer to "may this room take
 * this much floor". The assembly's parts ask it before giving a room more floor than it planned.
 *
 * - Sized by what it holds (a core round its machines, a medbay round its cots, a gun bay round its mount): a quarter
 *   again, the slack the street rows always allowed.
 * - Variable (a mess, a rec room, a store, a barracks): up to half again; its furnishing fills the floor.
 * - Open (a garden, a plaza): up to three times.
 * - Shaped by the hull on purpose (a star fort's bastion): whatever the hull gives.
 */
export const SLACK = 1.25;

export function stretchOf(r: RoomSpec): number {
  if (r.bastion) return Infinity;
  if (r.role === 'garden' || r.role === 'plaza') return 3;
  if (r.role === 'cargo' || (r.role === 'support' && r.dept === 'commons') || isBarracks(r)) return 1.5;
  return SLACK;
}
