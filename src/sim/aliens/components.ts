import { defineComponent } from '../ecs';

/**
 * Egg sac life cycle. 'dormant' waits to be disturbed (`leaking` is the cracked look, same rules). 'hatching' plays
 * stages 0..2 (`.hatch0` swells, `.hatch1` rips, `.hatch2` falls open and lets the alien out). 'burst' is the spent skin,
 * either hatched or destroyed before it could (`destroyed`).
 */
export type EggSacState = 'dormant' | 'hatching' | 'burst';

/** An egg sac on a derelict's deck: its own entity (not crew), tile (x, y) is its top-left in sector tiles. */
export interface EggSac {
  /** The ShipC entity it lies on (its aliens are leashed to it). */
  ship: number;
  x: number;
  y: number;
  /** Footprint, 1 (1x1) or 2 (2x2). */
  size: number;
  state: EggSacState;
  /** Cracked and leaking: a look only (`decay.eggsac.<n>.cracked`). */
  leaking: boolean;
  hp: number;
  max: number;
  /** Hatching stage 0..2 while hatching. */
  stage: number;
  /** Ticks left in the current stage (hatching), or until a chained hatch starts (dormant with `chain`). */
  timer: number;
  /** A nearby sac hatched: this one starts hatching when `timer` runs out. */
  chain: boolean;
  /** Burst by damage before it hatched (no alien came out). */
  destroyed: boolean;
}
export const EggSacC = defineComponent<EggSac>('eggSac');

/** A nest (`decay.eggs`): lays new egg sacs nearby every so often while a non-alien is aboard, up to a cap. */
export interface Nest {
  ship: number;
  x: number;
  y: number;
  /** Ticks a non-alien has been aboard since the last sac. */
  timer: number;
  /** Sacs laid so far. */
  laid: number;
}
export const NestC = defineComponent<Nest>('nest');

/** An alien creature (also a crew entity of a `creature` species, faction 'alien'): leashed to the ship it hatched on. */
export interface Alien {
  /** Home ship (ShipC entity): it never leaves this ship's tiles. */
  ship: number;
  /** Where it idles: the tile it hatched on. */
  homeX: number;
  homeY: number;
}
export const AlienC = defineComponent<Alien>('alien');
