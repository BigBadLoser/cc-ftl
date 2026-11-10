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
  /** Interest (docs/TRAITS.md 10.7): 0 none, 1 keen, 2 passionate; `struck`: a won't-do rules the skill out. */
  interest: 0 | 1 | 2;
  struck: boolean;
  /** XP into the next level, out of `per` (the level's width; 0 at the XP cap). */
  xp: number;
  per: number;
  /** XP gain multiplier from interest and traits for this skill (1 = none). */
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
  /** Null for crew without moods (robots). `source`: the trait that set or changed the factor. `strain`: what can set off a break now whatever the mood. */
  mood: { value: number; base: number; factors: { label: string; value: number; source?: string }[]; workMult: number; strain: string } | null;
  skills: UiSkillDetail[];
  /** "Station brat · Salvage diver", and what they won't do; empty for crew without a background. */
  background: string;
  wontDo: string[];
  stats: UiStatDetail[];
  traits: { id: string; name: string; kind: string; flavour: string; effect: string; short: string }[];
  gear: UiGearSlot[];
  /** The stats card of every hand weapon, as this crew member would use it (their skill): the wielded one and those in storage. */
  cards: Record<string, UiItemCard>;
  /** Friends and rivals (docs/TRAITS.md section 6); empty for crew without moods. */
  bonds: UiBonds;
  /** The Social tab (null for crew without moods). */
  social: UiSocial | null;
}

/** What one crew member thinks of another, for the card and the hover line. */
export interface UiBond {
  /** The other crew member's entity id (0 when they are no longer aboard). */
  id: number;
  name: string;
  score: number;
  kind: 'friend' | 'rival' | null;
  /** "Friend: fought together at Ithra". */
  line: string;
}

/** The crew card's relationships: the living friends and rivals by name. */
export interface UiBonds {
  friends: UiBond[];
  rivals: UiBond[];
}

/** The line shown over a crewmate the pointer is on while another is selected: what the selected one thinks of them. */
export interface UiOpinionHover extends UiBond {
  tone: 'good' | 'bad' | 'plain';
}

/** One line of a bond's merged history: `who` is whose opinion it moved ("both" when one event moved both). */
export interface UiHistoryLine {
  who: 'me' | 'them' | 'both';
  text: string;
  good: boolean;
  /** Game seconds ago, when the snapshot was taken. */
  agoSec: number;
}

/** One crewmate in the Social tab, from the inspected crew member's side. */
export interface UiSocialRow {
  id: number;
  name: string;
  myName: string;
  section: 'friends' | 'rivals' | 'crew';
  /** What the inspected one thinks of them, and the other way, -100..100. */
  mine: number;
  theirs: number;
  tag: 'mutual' | 'one-sided' | null;
  summary: string;
  history: UiHistoryLine[];
  effects: { text: string; good: boolean }[];
  /** Real behaviours the bond changes (meal, break and bed choice). */
  behaviours: UiBehaviour[];
}

export interface UiBehaviour {
  icon: 'food' | 'cup' | 'sleep';
  text: string;
}

export interface UiSocial {
  friends: UiSocialRow[];
  rivals: UiSocialRow[];
  crew: UiSocialRow[];
  caps: { friends: number; rivals: number };
  /** The live mood from people nearby: who, and the mood it adds. */
  moodLine: { who: string; value: number }[];
}
