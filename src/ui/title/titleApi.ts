import type { UiApi } from '../api';

/** What the title screen may call (built in app/title/boot.ts). */
export interface TitleApi {
  /** The saves, as the Load page lists them (no saving from here). */
  saves: UiApi['saves'];
  canContinue(): boolean;
  continueGame(): void;
  /** Begin a new game as planned on the crew screen (reloads the page into it): that ship, seed and crew. */
  startGame(plan: UiCrewPlan): void;
  /** A fresh random seed for a new crew screen. */
  newSeed(): number;
  /** The crew berths of a ship (the crew screen's slots). */
  roles(ship: string): string[];
  /** The jobs a ship needs someone for (the "Ship's jobs" list) and the skills that cover each. */
  shipJobs(ship: string): UiShipJob[];
  /** Roll the crew of a plan, exactly as the started game will (the sim's own roll, keyed by seed, slot and rerolls). */
  rollCrew(plan: UiCrewPlan): UiRollCrew[];
  /** A crew portrait from a look, or null while the backdrop's art loads. */
  portrait(look: UiRollCrew['look']): string | null;
  /** Draw `ship` in the backdrop canvas; dispose to stop. */
  stage(canvas: HTMLCanvasElement, ship: string): Promise<{ dispose(): void; ready: Promise<void> }>;
}

/** One skill of a rolled crew member: the rolled level, what traits add and take away, the interest (0 none, 1 keen, 2 passionate), and whether a won't-do rules it out. */
export interface UiRollSkill { skill: string; name: string; rolled: number; trait: number; lost: number; value: number; interest: 0 | 1 | 2; struck: boolean }

/** A job a ship needs (Helm, Repair...): the skills that cover it. */
export interface UiShipJob { id: string; name: string; skills: string[] }

/** One crew-screen slot as rolled (app/title/crewRoll.ts): what the started game will hold. */
export interface UiRollCrew {
  slot: number;
  role: string;
  /** The cosmetic title from their best skill ("Engineer", "Hand"), or the kind's name for robots. */
  title: string;
  name: string;
  rerolls: number;
  /** "Station brat · Salvage diver", and the dossier lines with what each adds; empty for robots. */
  background: string;
  backgroundLines: { name: string; line: string; adds: string }[];
  /** A knack (a surprise skill), and what they won't do. */
  knack: string | null;
  wontDo: string[];
  look: { species: string; role: string; appearanceSeed: number };
  /** One line in words: the traits' flavour. */
  read: string;
  traits: { id: string; name: string; kind: string; effect: string; short: string; flavour: string }[];
  skills: UiRollSkill[];
  /** The stats grid: label, value, and the trait behind it (good or bad) when one changes it. */
  stats: { label: string; value: string; source?: string; good?: boolean }[];
}

/** The crew screen's state that Start passes on: the seed the preview rolled with, the ship, and one pick per berth (its kind, from the ship). */
export interface UiCrewPlan {
  seed: number;
  ship: string;
  picks: { role: string; rerolls: number; name?: string }[];
}
