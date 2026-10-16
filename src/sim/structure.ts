import type { FieldSpec } from './grid';

/** Structural kind of a tile, stored in the `struct` field. Materials/variants come later. */
export const Struct = {
  Space: 0,
  Floor: 1,
  Wall: 2,
  Door: 3,
} as const;
export type StructKind = (typeof Struct)[keyof typeof Struct];

/**
 * Fields every ship/station/derelict grid has. Grid coordinates: x = column, y = row.
 * World mapping (render): tile (x, y) occupies world X in [x, x+1], Z in [y, y+1], floor at Y = 0.
 */
export const SHIP_FIELDS = {
  /** StructKind per tile. */
  struct: 'u8',
  /** Room id per tile (0 = none). Derived by the rooms system from `struct`. */
  room: 'u16',
  /** Oxygen partial pressure in kPa (normal 21). Space tiles are a fixed 0. */
  o2: 'f32',
  /** Carbon dioxide partial pressure in kPa (normal 0.04). */
  co2: 'f32',
  /** Temperature in degrees C (normal 20). Space tiles are fixed at SPACE_TEMP. */
  temp: 'f32',
  /** Fire intensity 0..255 (0 = no fire). */
  fire: 'u8',
  /** Smoke density 0..255. */
  smoke: 'u8',
  /** Light level 0..255, derived by the lighting system. Below LIGHT_DARK_BELOW counts as dark. */
  light: 'u8',
  /** Door openness 0 (closed) .. 255 (open). Only meaningful on Door tiles. */
  door: 'u8',
  /** Entity id of the module occupying the tile (0 = none). Written by module spawn/remove. */
  module: 'u32',
  /** Entity id of the loose item stack lying on the tile (0 = none). At most one stack per tile. */
  item: 'u32',
} as const satisfies FieldSpec;

/** True if crew can stand on this tile kind (ignores modules: see modules/walk.ts). */
export function isWalkable(kind: number): boolean {
  return kind === Struct.Floor || kind === Struct.Door;
}

/** Gas conductance of a tile: 0 walls and closed doors, 1 floor/space, a fraction for a partly open door. */
export function gasConductance(kind: number, doorOpen: number): number {
  if (kind === Struct.Floor || kind === Struct.Space) return 1;
  if (kind === Struct.Door) return doorOpen / 255;
  return 0;
}
