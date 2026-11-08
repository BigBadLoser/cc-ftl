import type { Faction } from '../combat/components';
import { defineComponent } from '../ecs';

/**
 * Consent to come aboard (#173): on a host ship, who is aboard it as a guest, by whose leave. The one record for every party that crosses onto a ship that is
 * not its own with the owner's agreement, so the rest of the sim asks one question (consent/guests.ts `guestOn`) instead of each owner's special case:
 * the fight code (`isInvader`), provocation, the observer, a station's alarm, bed ownership and who works aboard read it and nothing else.
 *
 * - Who: the guests are a side (`faction`) and an away site's party (crew whose `AwayC.site` is `site`), named `crew`, or both; a grant naming neither
 *   covers its whole side.
 * - Granted by: `by`, the code that agreed it and owns its end; `from` tells apart the grants of one owner (the guests' own ship or craft).
 *   - 'aid' (scene/aid.ts): help agreed with a scene ship; on that ship, for its aid site's party. Works aboard.
 *   - 'yard' (yard/crew.ts): the shipyard's contractors, on the player's ship, for the yard site's party and its named crew. Works aboard.
 *   - 'visit' (scene/visit.ts): a scene skiff's party let dock with the player's ship, its named crew, `from` the skiff. Does not work aboard.
 *   - 'trade' (trade/deals.ts): the player's side, on a station, while a trade run is docked there, `from` the shuttle. Does not work aboard.
 *   - 'passage' (consent/passage.ts): a person carried as a passenger (a rescued patient, a survivor, a fare), on the player's ship, its named
 *     crew. Lodges, and works aboard: they pitch in with a few chores at the lowest priority (`PASSENGER_CHORES`), never drafted, armed or sent out.
 * - Works aboard (`work`): the guests take the host ship's jobs. A guest without it is off duty there: no jobs, no boarding drive (they stand by).
 * - Lodges (`lodge`): the guests live aboard as the crew do: each owns a bed, sleeps, gets hungry and eats from the host's stock (the `guest` crew
 *   kind, `policy.guest`). A lodging guest is never off duty (`isOffDuty`); without `work` they take no jobs (`refusesWork`), with it their own
 *   priorities say which.
 * - Revoked by: its owner dropping it (`revoke`), or, whatever the owner does, the host being at war with the guests' side (a provoked ship's leave is void
 *   at once). A grant whose site is gone covers nobody by that site.
 */
export interface Grant {
  by: 'aid' | 'visit' | 'yard' | 'trade' | 'passage';
  faction: Faction;
  site?: number;
  crew?: number[];
  from?: number;
  work?: true;
  lodge?: true;
  /**
   * 'passage': what a person a scene handed on carries aboard (scene/carried.ts): the event whose rules follow them after the pocket is gone, the galaxy
   * faction they are from, the credits they carry, and the rule keys fired about them so far (each fires once, saved with the ship).
   */
  carry?: Carry;
  since: number;
}
/** What a person a scene handed on carries (`Grant.carry`; scene/carried.ts), and where their asking to join stands (galaxy/joinOffer.ts). */
export interface Carry {
  event: string;
  origin: string;
  purse: number;
  fired: string[];
  /** The tick their mood rose above the bar and has stayed there since (absent: it is not above it now). */
  happySince?: number;
  /** The one roll for asking while aboard is spent; `asked`: they asked to join (once, aboard or at delivery); `asking`: the tick an ask still waits for an answer. */
  rolled?: true;
  asked?: true;
  asking?: number;
}
export interface Consent {
  grants: Grant[];
}
export const ConsentC = defineComponent<Consent>('consent');
