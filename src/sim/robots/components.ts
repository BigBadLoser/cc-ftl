import { defineComponent } from '../ecs';
import type { Faction } from '../combat/components';

/**
 * A robot run by an AI core: it acts only while the ship on grid `gridId` (its home) has a live AI core (intact,
 * powered, not hacked) and still belongs to the robot's faction. Given to core-linked species spawned on rogue ships.
 */
export interface CoreLink {
  gridId: number;
  /** The faction the robot was built for; a held hack lends it to the hacker's side, and it returns to this. */
  faction: Faction;
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

/**
 * On an AI core module that was hacked: it no longer runs anything for its owners. While `hacker` (a crew member of
 * `by`) stays at the core, its linked robots fight for `by`; once the hacker leaves (0) they go inert. Re-hackable.
 */
export interface Hacked {
  by: Faction;
  tick: number;
  hacker: number;
}
export const HackedC = defineComponent<Hacked>('hacked');

/** Robot bay state (created lazily): hp of repair already paid for with an item. */
export interface RobotBay {
  credit: number;
}
export const RobotBayC = defineComponent<RobotBay>('robotBay');

/** Robot fabricator state (created lazily): ticks toward the next robot, robots it made, and how many so far. */
export interface Fabricator {
  timer: number;
  made: number[];
  count: number;
}
export const FabricatorC = defineComponent<Fabricator>('fabricator');
