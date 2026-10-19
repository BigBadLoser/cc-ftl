import type { SuitDef } from '../sim';

/**
 * The EVA spacesuit. Kept at an airlock (module.airlock holds `airlock.suits` of them), put on and taken off there.
 * A tank lasts four game minutes of thin air or open space and refills when the suit is stowed. Suited crew walk 20%
 * slower, work 10% slower and land 20% fewer hand-weapon hits. Off a hovering shuttle they drift 1.5 tiles/s across gaps up to 4 tiles.
 */
export const suit = {
  airSec: 240,
  donSec: 5,
  doffSec: 3,
  moveMult: 0.8,
  workMult: 0.9,
  accuracyMult: 0.8,
  floatSpeed: 1.5,
  floatRange: 4,
} satisfies SuitDef;
