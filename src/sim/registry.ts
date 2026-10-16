import type { WorkCategory } from './crew/components';

/** ASCII ship layout. One char per tile, rows top to bottom (row index = y). */
export interface ShipTemplate {
  name: string;
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
