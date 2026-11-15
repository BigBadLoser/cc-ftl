import type { Module } from '../modules/components';
import type { ModuleDef } from '../registry';

/**
 * Berths: the one owner of "who lies in which part of a bed". A bed module has `ModuleDef.berths` berths (default 1; the double bunk 2: berth 0 the lower
 * deck, 1 the upper). The crew member holding a berth is stored on the module: `reservedBy` for berth 0 (a one-berth bed is exactly as before) and
 * `reservedMore[i - 1]` for the others. Callers (sleep, rescue, recovery, the audit, the bed-owner pass, the renderer) ask here; none reads `reservedBy` for a bed itself.
 */

/** How many crew a bed takes at once (0 for a module that is no bed). */
export const berthCount = (def: ModuleDef | undefined): number => (def?.bed ? def.berths ?? 1 : 0);

/** The crew member holding berth `i` of the bed, or 0 when it is free. */
export function berthHolder(m: Module, i: number): number {
  return i === 0 ? m.reservedBy : m.reservedMore?.[i - 1] ?? 0;
}

/** Hold berth `i` for `crew` (0 frees it). */
export function setBerth(m: Module, i: number, crew: number): void {
  if (i === 0) {
    m.reservedBy = crew;
    return;
  }
  const more = (m.reservedMore ??= []);
  while (more.length < i) more.push(0);
  more[i - 1] = crew;
  if (!more.some((c) => c !== 0)) delete m.reservedMore; // a bunk with nobody on the upper deck saves like any other module
}

/** The berth `crew` holds in the bed, or -1. */
export function berthOf(def: ModuleDef | undefined, m: Module, crew: number): number {
  for (let i = 0; i < berthCount(def); i++) if (crew !== 0 && berthHolder(m, i) === crew) return i;
  return -1;
}

/** The lowest free berth, or -1 when the bed is full. `prefer` (a crew member's owned berth) comes first when it is free. */
export function freeBerth(def: ModuleDef | undefined, m: Module, prefer = -1): number {
  const n = berthCount(def);
  if (prefer >= 0 && prefer < n && berthHolder(m, prefer) === 0) return prefer;
  for (let i = 0; i < n; i++) if (berthHolder(m, i) === 0) return i;
  return -1;
}

/** Every crew member holding a berth of the bed, lower deck first. */
export function berthHolders(def: ModuleDef | undefined, m: Module): number[] {
  const out: number[] = [];
  for (let i = 0; i < berthCount(def); i++) if (berthHolder(m, i) !== 0) out.push(berthHolder(m, i));
  return out;
}

/**
 * Hold a berth for `crew`: the one they already hold, else `prefer` or the lowest free one; a full bed is overwritten on berth 0 (the old one-bed rule for a
 * caller that insists). Returns the berth.
 */
export function holdBerth(def: ModuleDef | undefined, m: Module, crew: number, prefer = -1): number {
  const had = berthOf(def, m, crew);
  const i = had >= 0 ? had : Math.max(0, freeBerth(def, m, prefer));
  setBerth(m, i, crew);
  return i;
}

/** Free the berth `crew` holds (no-op when they hold none). */
export function releaseBerth(def: ModuleDef | undefined, m: Module, crew: number): void {
  const i = berthOf(def, m, crew);
  if (i >= 0) setBerth(m, i, 0);
  else if (crew !== 0 && m.reservedBy === crew) m.reservedBy = 0; // berth 0 is `reservedBy` whatever the def says (a module that stopped being a bed)
}

/** A cut moved a bed's crew away: free the berths whose holder `gone` says left. */
export function clearGoneBerths(m: { reservedBy: number; reservedMore?: number[] }, gone: (id: number) => boolean): void {
  if (gone(m.reservedBy)) m.reservedBy = 0;
  if (m.reservedMore) {
    m.reservedMore = m.reservedMore.map((c) => (gone(c) ? 0 : c));
    if (!m.reservedMore.some((c) => c !== 0)) delete m.reservedMore;
  }
}
