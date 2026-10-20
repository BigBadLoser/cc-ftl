import type { ModuleDef, ShipTemplate } from '../registry';
import type { Rng } from '../rng';

/**
 * Derelict ruin pass: types shared by its stages (ruin*.ts). The pass turns a ship template into a derelict and
 * describes everything the template rows cannot carry (module hp, power, door state, air, loose loot, dressing, hooks)
 * in a plain, serialisable `RuinMeta`. Coordinates are ship-local, like the template.
 */

/** What made the wreck: a recent fight (concentrated damage, fires) or long neglect (spread decay, cold, stripped). */
export type RuinCause = 'combat' | 'decay';

export interface RuinOpts {
  /** 0..1 (default 0.5): scales every stage. */
  intensity?: number;
  /** Forces the cause (default: rolled from the seed). */
  cause?: RuinCause;
  /** Module defs (footprints, storage, power). */
  defs: Record<string, ModuleDef>;
  /** Who lives in the wreck later: aliens (egg sacs, nests) or a rogue AI (robot spawns). Default 'alien'. */
  infest?: 'alien' | 'robot' | 'none';
  /** Faction id the ship came from (alien hooks: old derelicts, or civilian / scrapper wrecks of any age). */
  origin?: string;
}

export type ModuleRuin = 'intact' | 'damaged' | 'destroyed';

export interface RuinModule {
  /** Index into the ruined template's `modules`. */
  index: number;
  def: string;
  state: ModuleRuin;
  /** Remaining hp as a fraction of max (0 when destroyed). */
  hp: number;
  /** Can crew still repair it (damaged) or strip it for parts (destroyed)? */
  salvage: 'repair' | 'strip' | 'none';
  /** Art to use instead of / over the normal sprite (e.g. 'decay.burnt.2x2', 'module.light.broken'). */
  art?: string;
  /** Lights only: alternate `art` with the normal sprite (a failing tube). */
  flicker?: boolean;
}

export type DoorRuin = 'free' | 'stuckOpen' | 'stuckShut';

export interface RuinDoor {
  x: number;
  y: number;
  state: DoorRuin;
}

/** One wrecked tile: what it was and which derelict art dresses it. */
export interface RuinBreach {
  x: number;
  y: number;
  /** hull: an outer wall blown out to space; wall: an inner wall torn out; floor: deck plating gone (space). */
  kind: 'hull' | 'wall' | 'floor';
  art: string;
}

/** A room's starting air. Vacuum rooms are open to space (directly or through a stuck-open door). */
export interface RuinRoom {
  id: number;
  tiles: number[];
  air: 'vacuum' | 'thin' | 'stale';
  /** Starting gas and temperature to apply on every tile (kPa, kPa, C). */
  o2: number;
  co2: number;
  temp: number;
}

export interface RuinItem {
  x: number;
  y: number;
  item: string;
  count: number;
}

export interface RuinCache {
  room: number;
  x: number;
  y: number;
  items: RuinItem[];
  /** How a boarding party gets in: through open doors, by cutting a stuck door, or only by EVA through a breach. */
  access: 'open' | 'forceDoor' | 'eva';
}

export interface RuinHook {
  kind: 'eggsac' | 'nest' | 'robotSpawn';
  x: number;
  y: number;
  /** Footprint (1 or 2). */
  size: number;
  art?: string;
}

/** A dressing prop or overlay on one tile (scorch, growth, debris, roof breach). */
export interface RuinDecal {
  x: number;
  y: number;
  art: string;
}

export interface RuinMeta {
  seed: number;
  cause: RuinCause;
  intensity: number;
  /** Impact centres (combat) or decay foci; for the viewer and later fx. */
  impacts: { x: number; y: number; r: number }[];
  breaches: RuinBreach[];
  /** Tiles removed by a shear (whole sections gone). */
  sheared: number;
  modules: RuinModule[];
  power: 'off' | 'emergency';
  doors: RuinDoor[];
  rooms: RuinRoom[];
  /** Fires still burning (combat wrecks only): tile and intensity 0..255. */
  fires: { x: number; y: number; level: number }[];
  items: RuinItem[];
  caches: RuinCache[];
  hooks: RuinHook[];
  decals: RuinDecal[];
}

export interface RuinResult {
  template: ShipTemplate;
  meta: RuinMeta;
}

/** Working state the stages share. `cells` are the template chars, row-major, padded to width x height. */
export interface RuinCtx {
  rng: Rng;
  defs: Record<string, ModuleDef>;
  width: number;
  height: number;
  cells: string[];
  modules: NonNullable<ShipTemplate['modules']>;
  intensity: number;
  infest: 'alien' | 'robot' | 'none';
  origin: string;
  meta: RuinMeta;
}
