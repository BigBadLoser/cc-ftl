/** ASCII ship layout. One char per tile, rows top to bottom (row index = y). */
export interface ShipTemplate {
  name: string;
  /** '.' space, '#' wall, '_' floor, 'D' door. Rows may differ in length; short rows pad with space. */
  rows: string[];
}

/** Content injected at boot. The sim only reads it; it is never saved. */
export interface ContentRegistry {
  ships: Record<string, ShipTemplate>;
}
