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
} as const satisfies FieldSpec;

/** True if crew can stand on this tile kind. */
export function isWalkable(kind: number): boolean {
  return kind === Struct.Floor || kind === Struct.Door;
}
