import type { RoomSpec } from '../plan';

/**
 * Which rooms a ship room may be walked into through (SHIPGEN_V4, "Room access"): some sit on a corridor only, some
 * open off a related room. The one answer for the navy layout's back row and annexes.
 */
export type RoomKind =
  | 'bridge' | 'engine' | 'reactor' | 'shields' | 'core' | 'plant' | 'workshop' | 'guns' | 'cargo' | 'pantry' | 'hangar'
  | 'mess' | 'barracks' | 'cabin' | 'medbay' | 'trauma' | 'brig' | 'farm' | 'other';

/** What a room is, by its role and what it holds. */
export function roomKind(r: Pick<RoomSpec, 'role' | 'mods' | 'dept' | 'cabin'>): RoomKind {
  const has = (m: string): boolean => r.mods.includes(m);
  switch (r.role) {
    case 'medbay': return has('module.recovery') ? 'trauma' : 'medbay';
    case 'quarters': return r.cabin ? 'cabin' : 'barracks';
    case 'support': return has('module.galley') ? 'mess' : has('module.fabricator') ? 'workshop' : 'other';
    case 'plant': return has('module.fabricator') ? 'workshop' : 'plant';
    case 'cargo': return r.dept === 'commons' ? 'pantry' : 'cargo';
    case 'weapons': return 'guns';
    case 'armoury': return has('module.stasis_wheel') ? 'brig' : 'other';
    case 'bridge': case 'engine': case 'reactor': case 'shields': case 'core': case 'hangar': case 'farm': return r.role;
    default: return 'other';
  }
}

/** Rooms whose only way in is a corridor. */
const HALL_ONLY: ReadonlySet<RoomKind> = new Set(['medbay', 'mess', 'cabin', 'workshop', 'bridge', 'brig']);
/** Rooms reached only through their host, never a corridor (annexes). */
const HOST_ONLY: Partial<Record<RoomKind, readonly RoomKind[]>> = { trauma: ['medbay'], pantry: ['mess'] };
/** Rooms that may also open off these. */
const THROUGH: Partial<Record<RoomKind, readonly RoomKind[]>> = { barracks: ['mess'], cargo: ['workshop', 'cargo'] };
/** Guns open off anything but the bridge, the crew's rooms and the stores. */
const NOT_GUNS: ReadonlySet<RoomKind> = new Set(['bridge', 'mess', 'barracks', 'cabin', 'medbay', 'trauma', 'pantry', 'cargo']);
/** The machinery: opens off its own kind. */
const MACHINES: ReadonlySet<RoomKind> = new Set(['engine', 'reactor', 'shields', 'core', 'plant']);

/** Whether a room may have a door onto a corridor. */
export const onHall = (r: RoomKind): boolean => !HOST_ONLY[r];

/** Whether room `r` may be walked into through room `front`. */
export function opensThrough(r: RoomKind, front: RoomKind): boolean {
  if (HALL_ONLY.has(r)) return false;
  const host = HOST_ONLY[r] ?? THROUGH[r];
  if (host) return host.includes(front);
  if (r === 'guns') return !NOT_GUNS.has(front);
  if (MACHINES.has(r)) return MACHINES.has(front);
  return r === front;
}
