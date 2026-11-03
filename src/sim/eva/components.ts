import { defineComponent } from '../ecs';

/**
 * A suited crew member drifting between a hovering shuttle and a ship's hull, a straight line in sector space (no grid
 * change: their Position is the hull tile all along). `out`: they left the hatch and land on their Position tile; `back`:
 * they leave that tile for the hatch and board when it ends. (sx, sy) is the shuttle's hatch side in sector tiles.
 * `refill`: out to the hatch and back to the same tile, the tank swapped at the turn (`total` covers both drifts). Movement is frozen while `ticks` run down from `total`.
 */
export interface EvaFloat {
  mode: 'out' | 'back' | 'refill';
  vehicle: number;
  sx: number;
  sy: number;
  ticks: number;
  total: number;
}
export const EvaFloatC = defineComponent<EvaFloat>('evaFloat');

/**
 * This crew member wears an EVA suit (own air supply, can walk the hull). `air` is seconds left in the tank, absent on a suit
 * made by `suit.set` (a full tank). A worn suit is the wearer's; stowing it adds it to the stock of the airlock or shuttle it is stowed at.
 */
export interface Suit {
  worn: true;
  air?: number;
  /** The hovering shuttle whose hatch it was fitted at (stowed back there). */
  vehicle?: number;
}
export const SuitC = defineComponent<Suit>('suit');

/**
 * Air set aside at a source for one crew member's later refills (the air ledger, `eva/airLedger.ts`): `sec` suit seconds at the airlock or
 * shuttle `kind`/`id`. Nobody else can draw it; the crew member's refills there spend it.
 */
export interface AirHold {
  crew: number;
  kind: 'airlock' | 'vehicle';
  id: number;
  sec: number;
}
/** The holds an entity owns (a site's shuttle, set as it leaves the site). They end with the owner's reason for them (`releaseAirHolds`). */
export interface AirHolds {
  holds: AirHold[];
}
export const AirHoldsC = defineComponent<AirHolds>('airHolds');
