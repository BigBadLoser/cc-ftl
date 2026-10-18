import { defineComponent } from '../ecs';
import type { Faction } from '../combat/components';

/**
 * A robot run by an AI core: it acts only while the ship on grid `gridId` (its home) has a live AI core (intact,
 * powered, not hacked) and still belongs to the robot's faction. Given to core-linked species spawned on rogue ships.
 */
export interface CoreLink {
  gridId: number;
}
export const CoreLinkC = defineComponent<CoreLink>('coreLink');

/** Present while a core-linked robot has no live core: it stands still, does nothing and counts as subdued. */
export interface Inert {
  tick: number;
}
export const InertC = defineComponent<Inert>('inert');

/** Ion- or EMP-stunned (ion-vulnerable species only) until this tick: out of action, but not subdued. */
export interface Stun {
  until: number;
}
export const StunC = defineComponent<Stun>('stun');

/** A destroyed robot body (it also carries DeadC): salvageable for its species' `wreck` items. */
export interface Wreck {
  tick: number;
}
export const WreckC = defineComponent<Wreck>('wreck');

/** On an AI core module that was hacked: it no longer runs its robots (or anything else). */
export interface Hacked {
  by: Faction;
  tick: number;
}
export const HackedC = defineComponent<Hacked>('hacked');

/** Robot fabricator state (created lazily): ticks toward the next robot, robots it made, and how many so far. */
export interface Fabricator {
  timer: number;
  made: number[];
  count: number;
}
export const FabricatorC = defineComponent<Fabricator>('fabricator');
