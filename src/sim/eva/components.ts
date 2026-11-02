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
