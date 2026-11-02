import { defineComponent } from '../ecs';
import type { WorkCategory } from '../crew/components';

/**
 * An away site (docs/DESIGN.md "Away sites", #286): a grid other than the player's own where the player wants crew to work, served by one
 * shuttle. It runs until it closes. `owner` is what opened it (`debug`: the `away.open` command; salvage moves onto sites in slice 3).
 * `closing`: the party is called home and the site ends when the shuttle is back. `demand` (work waiting per category) is set by the owner;
 * absent, the site counts the open jobs on its grid.
 */
export interface AwaySite {
  owner: 'debug' | 'salvage';
  status: 'open' | 'closing';
  vehicle: number;
  since: number;
  demand?: Partial<Record<WorkCategory, number>>;
  /** Why no passenger comes: no crew took an open passage for a while (the panel shows it; slice 3). */
  block?: 'noCrew';
}
export const AwaySiteC = defineComponent<AwaySite>('awaySite');

/**
 * The run of the shuttle that serves a site, on the vehicle (a vehicle order like `FerryC`; it flies itself).
 * - 'board': at home (stowed in its bay, or docked at a home airlock): those aboard step out, passages are posted for the free seats, and it
 *   leaves once its passengers are in (or the wait is over).
 * - 'fly': on its way to the site (hover beside it).
 * - 'stay': hovering beside the site. Passengers go out; those who want home come aboard; a trip home leaves through the departure check.
 * - 'home': on its way home.
 * - 'recall': the site is closing or a fight started: everyone comes aboard (lifted after AWAY_LIFT_SEC), then 'home'.
 */
export type SitePhase = 'board' | 'fly' | 'stay' | 'home' | 'recall';
export interface SiteRun {
  site: number;
  phase: SitePhase;
  /** Ticks in this phase. */
  timer: number;
  /** Tick the last trip home left the site (0: none yet). */
  lastTrip: number;
  /** Tick the first passenger of this stop at home boarded. */
  boardedAt?: number;
  /** Set while the trip home ends the run (the site closed or is gone). */
  ending?: true;
}
export const SiteRunC = defineComponent<SiteRun>('siteRun');

/**
 * On a crew member of a site's party (from boarding at home until they step out at home again). The party is a query, never a stored
 * list. `cat`: the work category of the passage they took. `landing`: sent out of the hatch, handed to the crew AI once on the hull.
 * `home`: came aboard to go home (waits for the next trip).
 */
export interface Away {
  site: number;
  vehicle: number;
  cat: WorkCategory;
  landing?: true;
  home?: true;
}
export const AwayC = defineComponent<Away>('away');
