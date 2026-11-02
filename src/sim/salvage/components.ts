import { defineComponent } from '../ecs';
import type { ScrapType } from '../registry';

/**
 * Why an order is not moving: something hostile is aboard (a living, non-surrendered hostile, an egg sac or a nest), the player has no free
 * shuttle with suits to send a team in (`noShuttle`), or no crew member is free and rested enough to go (`noCrew`).
 */
export type SalvageBlock = 'hostile' | 'noShuttle' | 'noCrew';

/** Every scrap type, in the order the inspector lists them. */
export const SCRAP_TYPES: readonly ScrapType[] = ['hull', 'tech', 'energy', 'weapons', 'comfort'];

/**
 * The player's salvage order, on a derelict (a wreck ShipC). Only parts that yield a ticked type are stripped. The order lives until
 * nothing of those types is left (the wreck then goes too if nothing at all is left) or it is cancelled.
 */
export interface SalvageOrder {
  types: ScrapType[];
  status: 'running' | 'blocked';
  /** Set while blocked. */
  block?: SalvageBlock;
  /** Stripping jobs finished under this order (kept across changes of the types): the progress bar counts up from it, never down. */
  done: number;
  /** Tick the order was given. */
  since: number;
  /** No new salvage team is sent before this tick (a pause after a shift, and between looks for a shuttle or crew). */
  teamAt?: number;
}
export const SalvageOrderC = defineComponent<SalvageOrder>('salvageOrder');

/**
 * 'board': the team walks to the shuttle's bay and climbs in (the first in flies it). 'fly': the shuttle heads for the wreck. 'work': it
 * hovers beside the wreck as the suit-refill point while the team strips it in suits and carries the loose scrap to it (with cargo runs
 * home when the hold is full). 'recall': the team floats back aboard. 'home': the shuttle flies back to its bay, where the team steps out
 * and the cargo hauls unload the hold.
 */
export type SalvagePhase = 'board' | 'fly' | 'work' | 'recall' | 'home';

/** Why a shift ended: the order is finished or gone, something hostile is aboard, a fight began, the team needs rest or food, the ship had no room for the hold, or it failed. */
export type SalvageTripEnd = 'done' | 'cancelled' | 'hostile' | 'combat' | 'tired' | 'noRoom' | 'lost' | 'noCrew';

/**
 * A cargo run home in the middle of a shift: one of the team (`pilot`) flies the full hold home and back while the rest work on.
 * 'call': the pilot (and `riders`, who would run low on air with no airlock on the wreck to refill at) float back aboard. 'home': flying
 * to the bay. 'unload': the ship's crew empty the hold (cargo hauls). 'back': flying back to the wreck.
 */
export interface CargoRun {
  pilot: number;
  riders: number[];
  stage: 'call' | 'home' | 'unload' | 'back';
  timer: number;
  /** Units in the hold when it reached the bay. */
  held?: number;
}

/** One shift of a salvage team, on the shuttle that carries it: the wreck (ShipC id), the team, and where the shift stands. */
export interface SalvageTrip {
  ship: number;
  crew: number[];
  phase: SalvagePhase;
  /** Ticks in this phase. */
  timer: number;
  /** Set once the shift is ending. */
  reason?: SalvageTripEnd;
  /** A cargo run under way. */
  run?: CargoRun;
  /** Tick the order was first seen finished with loot still lying about (the team carries it off before going home). */
  doneAt?: number;
}
export const SalvageTripC = defineComponent<SalvageTrip>('salvageTrip');

/**
 * On a crew member of a salvage team: the shuttle they came on. `refill`: they are walking off to refill their suit, at the shuttle (0) or at
 * this airlock module on the wreck. They keep their suit on while idle (no stowing it at the wreck's airlocks).
 */
export interface SalvageCrew {
  vehicle: number;
  refill?: number;
  /** Sent out of the hatch and not landed yet: handed back to the crew AI once on the hull. */
  landing?: true;
}
export const SalvageCrewC = defineComponent<SalvageCrew>('salvageCrew');
