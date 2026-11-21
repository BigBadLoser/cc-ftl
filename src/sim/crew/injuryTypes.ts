import { defineComponent } from '../ecs';
import type { StatName } from '../stats';

/**
 * Crew injuries (DESIGN.md "Injuries and cyberware", slice 1, #601): the content shapes, the component and the events. Content is data
 * (content/injuries.ts, `satisfies InjuryContent`), referenced by string id; the rules live in crew/body.ts (part condition, capacities),
 * crew/injure.ts (taking damage) and crew/injuryCare.ts (bleeding, healing, scars, treatment).
 */

/** What a capacity is: a body function fed by parts. */
export type Capacity = 'manipulation' | 'moving' | 'sight' | 'consciousness' | 'breathing' | 'bloodPumping';

/** Where an injury comes from: each has its own part weights and kind table (`InjurySourceDef`). */
export type InjurySource = 'bullet' | 'blade' | 'blast' | 'fire' | 'vacuum' | 'downed';

/** One body part. Its condition (0..1) feeds `capacity`: summed by `share` with the other parts of it, or multiplying it (`gate`, the spine for moving). */
export interface BodyPartDef {
  name: string;
  group: 'head' | 'torso' | 'limb';
  capacity: Capacity;
  /** Share of the capacity (the shares of one capacity sum to 1). Absent with `gate`. */
  share?: number;
  /** The capacity is multiplied by this part's condition instead. */
  gate?: true;
  /** Brain, heart, lungs: destroyed, it downs the crew member, who dies without surgery. */
  vital?: true;
}

/** A capacity: its floor (what is left with every part of it gone) and the stats it scales (`weight`: the share of the stat it takes away at 0). */
export interface CapacityDef {
  name: string;
  floor?: number;
  stats: Partial<Record<StatName, number>>;
}

/** One kind of injury on the severity ladder. */
export interface InjuryKindDef {
  name: string;
  /** minor: heals on its own; serious: heals only once treated, and untreated may set as a scar. */
  severity: 'minor' | 'serious';
  /** How much of the part's condition it takes while fresh (it gives it back as it heals). */
  damage: number;
  /** Seconds to heal at the base rate (treated, for a serious one). */
  healSec: number;
  /** Only on these parts (absent = any). */
  parts?: readonly string[];
  /** A fresh one bleeds this many hp per second while the crew member stands, for `bleedSec` or until first aid. */
  bleed?: number;
  bleedSec?: number;
  /** Serious: the lasting condition loss of a scar. */
  scarLoss?: number;
}

/** How a source injures: which parts it hits (weights) and with which kinds. */
export interface InjurySourceDef {
  /** A hit of at least this many hp may injure; a dose source injures each time its harm adds up to it. */
  threshold: number;
  /** Chance a hit over the threshold injures (dose sources: every dose does). */
  chance: number;
  /** A hit of this many hp or more is serious; between the threshold and this, the chance ramps up. */
  seriousAt: number;
  /** A floor on the serious chance (dose sources, `downed`: 1). */
  seriousChance?: number;
  /** Parts injured at once (fire burns several). Default 1. */
  count?: number;
  parts: Readonly<Record<string, number>>;
  minor: readonly string[];
  serious: readonly string[];
}

export interface InjuryContent {
  parts: Readonly<Record<string, BodyPartDef>>;
  capacities: Readonly<Record<Capacity, CapacityDef>>;
  kinds: Readonly<Record<string, InjuryKindDef>>;
  sources: Readonly<Record<InjurySource, InjurySourceDef>>;
}

/** One injury on a crew member. */
export interface Injury {
  part: string;
  kind: string;
  /** Where it is on the ladder: a scar and a destroyed part are for good. */
  sev: 'minor' | 'serious' | 'scar' | 'destroyed';
  /** Seconds since it happened (an untreated serious one may scar after a while). */
  age: number;
  /** Seconds of healing done (out of the kind's `healSec`). */
  heal: number;
  /** Still bleeding (fresh cuts and punctures). */
  bleeding?: true;
  /** Treated by a medic at a medical bed: the healing quality (a multiplier). */
  treated?: number;
  /** Seconds of a medic's treatment so far. */
  treat?: number;
}

/** A crew member's injuries, and the harm a dose source (fire, vacuum) has dealt since its last injury. */
export interface Injuries {
  list: Injury[];
  dose?: Partial<Record<InjurySource, number>>;
}
export const InjuriesC = defineComponent<Injuries>('injuries');

/** Output only (the ship's log): a new injury (`severity` destroyed: the part is lost), a serious one set as a scar, one a medic treated. */
export type InjuryEvent =
  | { type: 'crew.injured'; crew: number; part: string; kind: string; severity: 'minor' | 'serious' | 'destroyed' }
  | { type: 'crew.scarred'; crew: number; part: string; kind: string }
  | { type: 'crew.injuryTreated'; crew: number; part: string; kind: string; by: number };
