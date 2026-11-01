import type { RoomRecipe } from './types';

/** Fallback steps when a berth plan does not fit: beds in a row along a long wall, a locker a bed, life support at an end. */
const ROW = [
  { mod: 'module.lifeSupport', count: 'spec', wall: 'end' },
  { mod: 'module.bed', count: 'spec', wall: 'long', row: true, rots: [0] },
  { mod: 'module.bed', count: 1, unless: 'module.bed', wall: 'long' },
  { mod: 'module.storage_locker', count: 'fill', per: 'module.bed', wall: 'long', near: 'module.bed', row: true },
] as const;

/**
 * Crew quarters, laid out whole (rooms/plans.ts): berths, each bed head to a wall with its locker, in barracks rows or
 * spread round the walls (FactionDef.berths); a third of them with a lounge table out on the floor when there is room.
 */
export const quarters = {
  fill: 0.55,
  arrangements: [
    { name: 'berths', weight: 2, plan: { kind: 'berths' }, steps: ROW },
    { name: 'berths and lounge', weight: 1, plan: { kind: 'berths', lounge: true }, steps: ROW },
  ],
} as const satisfies RoomRecipe;
