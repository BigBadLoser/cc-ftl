import type { Faction } from '../combat/components';
import { defineComponent } from '../ecs';

/**
 * Consent to come aboard (#173): on a host ship, who is aboard it as a guest, by whose leave. One record for every party that crosses onto a ship that is not
 * its own with the owner's agreement, so the rest of the sim asks one question (consent/guests.ts `guestOn`) instead of each owner's special case.
 *
 * - Who: the guests are a side (`faction`) and either an away site's party (crew whose `AwayC.site` is `site`) or named `crew`, or both.
 * - Granted by: `by`, the code that agreed it and owns its end. Built: 'aid' (scene/aid.ts: help agreed with a scene ship, guests = its aid site's party).
 *   The shape fits the others that cross today: an ambush skiff's party let aboard the player's ship ('visit', named crew), yard contractors ('yard',
 *   named crew), trade handover crews ('trade').
 * - Revoked by: its owner dropping it (`revoke`), or, whatever the owner does, the host being at war with the guests' side (a provoked ship's leave is void
 *   at once). A grant whose site is gone covers nobody by that site.
 */
export interface Grant {
  by: 'aid' | 'visit' | 'yard' | 'trade';
  faction: Faction;
  site?: number;
  crew?: number[];
  since: number;
}
export interface Consent {
  grants: Grant[];
}
export const ConsentC = defineComponent<Consent>('consent');
