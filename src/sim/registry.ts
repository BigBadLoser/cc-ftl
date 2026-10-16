import type { WorkCategory } from './crew/components';

/** ASCII ship layout. One char per tile, rows top to bottom (row index = y). */
export interface ShipTemplate {
  name: string;
  /** Modules to place at game start; `rot` is quarter turns clockwise (0..3). */
  modules?: { def: string; x: number; y: number; rot: number }[];
  /** '.' space, '#' wall, '_' floor, 'D' door. Rows may differ in length; short rows pad with space. */
  rows: string[];
}

/** Content injected at boot. The sim only reads it; it is never saved. */
export interface ContentRegistry {
  ships: Record<string, ShipTemplate>;
  /** Role content id (e.g. 'role.engineer') to definition. */
  roles: Record<string, RoleDef>;
  /** Species content id (e.g. 'species.human') to definition. */
  species: Record<string, SpeciesDef>;
  /** Module content id (e.g. 'module.reactor') to definition. */
  modules: Record<string, ModuleDef>;
  /** Pool of first names for generated crew. */
  crewNames: string[];
}

/** A crew role: default priorities for each work category (0 = off, 1 = highest .. 4). */
export interface RoleDef {
  name: string;
  priorities: Record<WorkCategory, number>;
}

/** A species: base stats. Modifiers (traits, implants) come later via the stat resolver. */
export interface SpeciesDef {
  name: string;
  /** Tiles per second. */
  moveSpeed: number;
  /** Work points per tick (1 = baseline). */
  workSpeed: number;
  /** Rest lost per second while awake. */
  restDecay: number;
}

/**
 * A placeable ship module. `footprint` is [w, h] at rotation 0; (x, y) of a placed module is the
 * top-left of its rotated bounding box. Offsets (`access`) are in rotation-0 local tiles.
 */
export interface ModuleDef {
  name: string;
  /** Render asset id, e.g. 'module.reactor' (resolved through the asset manifest). */
  asset: string;
  footprint: readonly [number, number];
  /** Solid modules block walking on their tiles. */
  solid: boolean;
  /** Tile (offset from the footprint's top-left) crew stand on to use it. */
  access?: readonly [number, number];
  /** Positive supplies power, negative draws it (units per second). */
  power: number;
  /** Power priority 1 (served first) .. 5. Default DEFAULT_PRIORITY. */
  priority?: number;
  /** Oxygen added per second, spread over the module's room. */
  o2PerSec?: number;
  /** CO2 removed per second, spread over the module's room. */
  co2ScrubPerSec?: number;
  /** Degrees C x tiles added per second, spread over the footprint. */
  heatPerSec?: number;
  /** Lights tiles of its own room within `radius` tiles; `level` is 0..255 at the source. */
  light?: { radius: number; level: number };
  /** 0..1 fuel factor for fire spread and growth. */
  flammability: number;
  maxHp: number;
  /** Construction work in ticks at workSpeed 1. */
  buildWork: number;
  bed?: true;
  workstation?: true;
}
