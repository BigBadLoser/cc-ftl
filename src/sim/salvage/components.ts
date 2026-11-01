import { defineComponent } from '../ecs';
import type { ScrapType } from '../registry';

/** Why an order is not moving: something hostile is aboard (a living, non-surrendered hostile, an egg sac or a nest). */
export type SalvageBlock = 'hostile';

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
}
export const SalvageOrderC = defineComponent<SalvageOrder>('salvageOrder');
