import { defineComponent } from '../ecs';
import type { Faction } from '../combat/components';

/** Which side a crew member fights for. Boarders keep theirs when they land on the enemy ship. */
export interface Allegiance {
  faction: Faction;
}
export const AllegianceC = defineComponent<Allegiance>('allegiance');

/** The hand weapon a crew member wields: an item id with a `hand` def, or null for bare hands. */
export interface Equip {
  weapon: string | null;
}
export const EquipC = defineComponent<Equip>('equip');

/** Crew walking to a storage module to take `item` out and wield it. */
export interface EquipOrder {
  item: string;
  storage: number;
}
export const EquipOrderC = defineComponent<EquipOrder>('equipOrder');

/**
 * Combat state of a crew member (created lazily by the crew combat system).
 * 'idle': not fighting, free to take jobs. 'engage': closing on or shooting `target`. 'flee': running from hostiles.
 */
export interface Fighter {
  mode: 'idle' | 'engage' | 'flee';
  /** Crew entity being fought, or 0. */
  target: number;
  /** Target the player ordered (drafted crew only), or 0. Overrides automatic targeting while it stays valid. */
  ordered: number;
  /** Drafted crew shoot at the nearest visible hostile on their own. */
  engage: boolean;
  /** Ticks until the next attack. */
  cooldown: number;
  /** Tick of the last path planned for chasing or fleeing. */
  planned: number;
  /** Tile the current chase/flee/objective path leads to. */
  goal?: { x: number; y: number };
}
export const FighterC = defineComponent<Fighter>('fighter');

/** Gave up: stops fighting and working, and counts as subdued (for capture). */
export interface Surrendered {
  tick: number;
}
export const SurrenderedC = defineComponent<Surrendered>('surrendered');
