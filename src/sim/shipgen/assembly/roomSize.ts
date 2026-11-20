import type { RoomSpec } from '../plan';
import { roomKind, type RoomKind } from './roomAccess';

/**
 * How big a navy room may get, and the filler rooms that take floor no planned room may (SHIPGEN_V4, "Room sizes and
 * fillers"). The one answer for the outline layout's sizes: every room is within its kind's range.
 */

/** How far past its plan a room of each kind grows, and its cap in floor tiles. */
const SIZE: Partial<Record<RoomKind, { grow: number; cap: number }>> = {
  guns: { grow: 1.3, cap: 48 }, shields: { grow: 1.3, cap: 48 }, core: { grow: 1.3, cap: 48 }, reactor: { grow: 1.3, cap: 48 },
  plant: { grow: 1.3, cap: 48 }, bridge: { grow: 1.3, cap: 60 }, barracks: { grow: 1.6, cap: 60 }, mess: { grow: 1.6, cap: 60 },
  medbay: { grow: 1.6, cap: 60 }, hangar: { grow: 1.5, cap: 120 }, cargo: { grow: 1.5, cap: 60 }, trauma: { grow: 1.3, cap: 40 },
  pantry: { grow: 1.3, cap: 40 }, brig: { grow: 1.3, cap: 40 }, farm: { grow: 1.3, cap: 45 }, workshop: { grow: 1.3, cap: 45 },
  lounge: { grow: 1.3, cap: 60 }, gym: { grow: 1.3, cap: 45 },
};

/** The most floor a room takes (its planned floor at least: its modules fit). */
export function maxArea(r: RoomSpec): number {
  const s = SIZE[roomKind(r)] ?? { grow: 1.5, cap: 60 }, plan = r.w * r.h;
  return Math.max(plan, Math.min(s.cap, Math.round(plan * s.grow)));
}

/** Filler kinds, the default first; the rest one a side each at most (a farm only on a ship that carries one). */
export type Filler = 'hold' | 'workshop' | 'lounge' | 'gym' | 'farm' | 'armoury'
  /** PROTOTYPE (#581): a big ship's spare-floor rooms, before the fillers. */
  | 'pd' | 'battery' | 'shop' | 'lab' | 'provisions'
  /** PROTOTYPE (#581): a carrier's escape pods. */
  | 'pods';
/** Floor a filler room takes, at least and at most. */
export const FILL_MIN = 9, FILL_MAX = 45;

/** A filler room of `area` floor tiles. */
export function fillerSpec(kind: Filler, area: number): RoomSpec {
  const n = (per: number, most: number): number => Math.max(1, Math.min(most, Math.floor(area / per)));
  switch (kind) {
    case 'hold': return { role: 'cargo', mods: Array<string>(n(5, 6)).fill('module.storage'), w: 3, h: 3, stock: true };
    case 'workshop': return { role: 'support', mods: ['module.fabricator', ...Array<string>(n(12, 2)).fill('module.storage_rack')], w: 4, h: 3 };
    case 'lounge': return { role: 'support', use: 'lounge', mods: ['module.gametable', 'module.arcade', ...Array<string>(n(12, 2)).fill('module.bench')], w: 4, h: 3 };
    case 'gym': return { role: 'support', use: 'gym', mods: Array<string>(n(6, 4)).fill('module.exercise'), w: 4, h: 3 };
    case 'armoury': return { role: 'armoury', mods: [], w: 9, h: 5 };
    case 'farm': return { role: 'farm', mods: Array<string>(n(6, 4)).fill('module.hydroponics'), w: 4, h: 3 };
    case 'pd': return { role: 'weapons', mods: Array<string>(n(15, 2)).fill('module.pointDefense'), w: 3, h: 3 };
    case 'battery': return { role: 'plant', mods: [...Array<string>(area >= 40 ? 8 : 4).fill('module.battery'), 'module.console'], w: 5, h: 4 };
    case 'shop': return { role: 'industry', mods: ['module.scrapper', 'module.storage_scrap', 'module.storage_scrap', 'module.storage_pallet'], w: 8, h: 5 };
    case 'lab': return { role: 'industry', mods: [...Array<string>(n(20, 2)).fill('module.research'), 'module.console', 'module.storage_locker'], w: 7, h: 4 };
    case 'pods': return { role: 'hangar', mods: Array<string>(n(16, 3)).fill('module.pod_bay'), w: 4, h: 4, vehicle: 'vehicle.escape_pod' };
    case 'provisions': return { role: 'cargo', mods: Array<string>(n(8, 4)).fill('module.storage_cold'), w: 7, h: 3 };
  }
}

/**
 * The filler for a leftover of `area` floor `deep` rows deep: the next kind left (`left`, used up as taken) where it is
 * at least a lounge's size, else a hold. A leftover past the fillers' max and deep enough for two rooms is a hold or
 * workshop on the corridor with a hold behind it, opening through it (cargo's access rule).
 */
export function fillerFor(left: Filler[], area: number, deep: number, behind: boolean): RoomSpec {
  // A hold never opens through another hold: a deep leftover is a workshop with a hold behind it, else one hold.
  if (area > FILL_MAX && behind) {
    const k = left.indexOf('workshop');
    if (k < 0) return fillerSpec('hold', area);
    left.splice(k, 1);
    const front = Math.round(area / 2);
    return { ...fillerSpec('workshop', front), annex: fillerSpec('hold', area - front) };
  }
  // The lounge takes a larger leftover (the crew's commons), the rest in turn.
  const k = area < 12 || deep < 3 ? -1 : area >= 24 && left.includes('lounge') ? left.indexOf('lounge') : left.findIndex((f) => f !== 'lounge');
  return fillerSpec(k >= 0 ? (left.splice(k, 1)[0] as Filler) : 'hold', area);
}

/** The crew's room a cabin block's corridor ends at: the lounge while it is left, else the gym, else a lounge all the same. */
export function crewRoom(left: Filler[], area: number): RoomSpec {
  const k = left.includes('lounge') ? left.indexOf('lounge') : left.indexOf('gym');
  return fillerSpec(k >= 0 ? (left.splice(k, 1)[0] as Filler) : 'lounge', area);
}
