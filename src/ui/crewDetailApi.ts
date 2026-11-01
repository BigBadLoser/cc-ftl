/**
 * The crew inspector's detail tabs (Status, Skills, Gear): plain data built by app/crewDetail.ts for the one selected crew
 * member of the player's. Read-only; changes still go through commands.
 */

/** One term of a breakdown: where it comes from, and how it applies (`add` points or a `mul` factor). */
export interface UiStatPart {
  label: string;
  /** Groups the term for colour: rolled start, experience, a trait, gear, the body's state or the surroundings. */
  kind: 'rolled' | 'xp' | 'trait' | 'gear' | 'state' | 'env';
  op: 'add' | 'mul';
  value: number;
}

export interface UiSkillDetail {
  skill: string;
  name: string;
  /** The level the sim uses (rounded `stat`). */
  value: number;
  /** The rolled start (or the role's skills for crew without a roll). */
  rolled: number;
  /** Levels earned from XP. */
  xpLevels: number;
  /** Everything else (traits, gear, state), each with its source. */
  mods: UiStatPart[];
  /** The role's level (0 for an off-role skill). */
  role: number;
  /** XP into the next level, out of `per` (the level's width; 0 at the XP cap). */
  xp: number;
  per: number;
  /** XP gain multiplier from traits for this skill (1 = none). */
  gain: number;
}

export interface UiStatDetail {
  stat: string;
  name: string;
  /** The species value before modifiers. */
  base: number;
  value: number;
  unit: '' | 'x' | 'tiles/s' | 'items';
  parts: UiStatPart[];
}

export interface UiCondition {
  key: string;
  label: string;
  /** What the readout says ("12 s to bleed out", "64% fed"). */
  text: string;
  /** A 0..100 bar when the condition has a level, else null. */
  pct: number | null;
  tone: 'good' | 'ok' | 'warn' | 'bad';
}

/** A hover card for an item: a title bar (name, kind), stat rows, and a foot (value) under a rule. */
export interface UiItemCard {
  title: string;
  sub: string;
  rows: { label: string; value: string; note?: string; extra?: { text: string; good: boolean } }[];
  foot: { label: string; value: string; note?: string }[];
  flavour?: string;
}

export interface UiGearSlot {
  slot: 'weapon' | 'suit' | 'hands' | 'implant';
  label: string;
  /** What fills it (`id`: the item id, for its sprite), or null for an empty slot. */
  item: { id: string; name: string; count?: number; natural?: boolean; card: UiItemCard | null } | null;
}

export interface UiCrewDetail {
  id: number;
  health: { hp: number; maxHp: number; conditions: UiCondition[] };
  /** Null for crew without moods (robots). `source`: the trait that set or changed the factor. */
  mood: { value: number; base: number; factors: { label: string; value: number; source?: string }[]; workMult: number } | null;
  skills: UiSkillDetail[];
  stats: UiStatDetail[];
  traits: { id: string; name: string; kind: string; flavour: string; effect: string; short: string }[];
  gear: UiGearSlot[];
  /** The stats card of every hand weapon, as this crew member would use it (their skill): the wielded one and those in storage. */
  cards: Record<string, UiItemCard>;
}
