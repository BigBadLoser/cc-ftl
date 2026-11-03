import { defineComponent } from '../ecs';
import type { WorkCategory } from '../crew/components';

/**
 * An away site (docs/DESIGN.md "Away sites", #286): a grid other than the player's own where the player wants crew to work, served by one
 * shuttle. It runs until it closes. `owner` is what opened it (`debug`: the `away.open` command; salvage moves onto sites in slice 3).
 * `closing`: the party is called home and the site ends when the shuttle is back. `demand` (work waiting per category) is set by the owner;
 * absent, the site counts the open jobs on its grid.
 */
export interface AwaySite {
  owner: 'debug' | 'salvage' | 'boarding' | 'yard';
  status: 'open' | 'closing';
  vehicle: number;
  since: number;
  demand?: Partial<Record<WorkCategory, number>>;
  /**
   * What holds the site up (the panel shows it; slice 3): `noCrew`, no crew took an open passage for a while; `noRoom`, the hold could not
   * be unloaded at home (the loot waits on the site); `stranded`, its shuttle is lost and no other free one can come.
   */
  block?: 'noCrew' | 'noRoom' | 'stranded';
  /** What a fight in the node does to the site (the owner's choice): absent, the party is called home; `stay`, it carries on (boarding). */
  fight?: 'stay';
  /** The party lands standing by for orders (drafted, as boarders are), not handed to the crew AI's jobs. */
  standBy?: true;
  /** The airlock of the site the owner wants the shuttle docked at (it takes any other free one, else hovers, when this one cannot). */
  dock?: number;
  /**
   * A named party (the player picked them): the site's passages are theirs alone, one each, held for them at once. Consumed when the shuttle
   * first leaves home: whoever is not aboard by then stays (`away.leftBehind`).
   */
  invited?: number[];
  /** The party's work is outside the hull: they land suited from the shuttle's stock even where they step out into air (the shipyard). */
  outside?: true;
  /** Nothing on the site is the party's to take home: no staging zone, no hauls into it, nothing loaded (a yard building on your own ship). */
  noLoot?: true;
}
export const AwaySiteC = defineComponent<AwaySite>('awaySite');

/**
 * The run of the shuttle that serves a site, on the vehicle (a vehicle order like `FerryC`; it flies itself).
 * - 'board': at home (stowed in its bay, or docked at a home airlock): those aboard step out, passages are posted for the free seats, and it
 *   leaves once its passengers are in (or the wait is over).
 * - 'fly': on its way to the site (hover beside it).
 * - 'stay': beside the site (hovering, or docked at one of its airlocks). Passengers go out; those who want home come aboard; a trip home
 *   is due on an urgent case at once, else when a batch trigger holds (away/trips.ts).
 * - 'depart': a trip is due: the last call and riders until the departure check passes (or it is given up and the run stays).
 * - 'home': on its way home (watched: it turns back when a worker left out would run short).
 * - 'pickup': a pickup run (`pickup` set, no site): beside the requester's grid until they are aboard, then 'home'.
 * - 'recall': the site is closing or a fight started: everyone comes aboard (lifted after AWAY_LIFT_SEC), then 'home'.
 */
export type SitePhase = 'board' | 'fly' | 'stay' | 'depart' | 'home' | 'recall' | 'pickup';
export interface SiteRun {
  site: number;
  phase: SitePhase;
  /** Ticks in this phase. */
  timer: number;
  /** Tick the shuttle last arrived at the site or left it (the trip timeout counts from it). */
  lastTrip: number;
  /** Tick the shuttle must be back at the site by, set on a trip home that leaves a worker counting on their own tank (the watch). */
  returnBy?: number;
  /** A pickup run: the crew member (not of a site's party) it fetches; `site` is then the grid they stand on. */
  pickup?: number;
  /** Tick the first passenger of this stop at home boarded. */
  boardedAt?: number;
  /** Units in the hold when the stop at home began (a stop that empties none of it: `noRoom`). */
  held?: number;
  /** Set while the trip home ends the run (the site closed or is gone). */
  ending?: true;
}
export const SiteRunC = defineComponent<SiteRun>('siteRun');

/**
 * On a crew member of a site's party (from boarding at home until they step out at home again). The party is a query, never a stored
 * list. `cat`: the work category of the passage they took. `landing`: sent out of the hatch, handed to the crew AI once on the hull.
 * `home`: came aboard to go home (waits for the next trip). `lastCall`: the departure check found them short: they refill now. `ride`: still
 * short after the last call: they come aboard for the round trip and go out again on the way back. `pickup`: a shuttle came for them (they
 * are out of air reach): they come aboard. `downAt`: the tick they were found downed out on the site (the lift's clock). `recall`: the player
 * called them home (`crew.recall`): they come aboard, and the trip that takes them is urgent.
 */
export interface Away {
  site: number;
  vehicle: number;
  cat: WorkCategory;
  landing?: true;
  home?: true;
  lastCall?: true;
  ride?: true;
  pickup?: true;
  downAt?: number;
  recall?: true;
}
export const AwayC = defineComponent<Away>('away');
