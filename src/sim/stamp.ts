import type { GridLike } from './grid';
import { SectorGrid } from './sectorGrid';
import { SHIP_EMPTY, SHIP_FIELDS } from './structure';

/**
 * A fresh, empty sector grid with the ship fields. Chunks are not released on write (no occupancy field): a chunk whose
 * structure is all gone can still hold module or item ids on Space tiles. `liftShip` releases the chunks it leaves wholly
 * empty (`SectorGrid.releaseEmpty`).
 */
export function newSectorGrid(): SectorGrid {
  return new SectorGrid(0, SHIP_FIELDS, SHIP_EMPTY, { occupancyField: null });
}

/**
 * Copy every field of `src` (ship-local coordinates) into the sector with its top-left tile at (x, y). Space tiles at
 * their empty values allocate nothing. Throws if the sector lacks one of the grid's fields.
 */
export function stampGrid(sector: SectorGrid, src: GridLike, x: number, y: number): void {
  for (const field of src.fieldNames()) {
    if (!sector.has(field)) throw new Error(`stampGrid: the sector has no field "${field}"`);
  }
  // struct first, so a chunk holding structure is allocated before its other fields are written
  const fields = src.fieldNames().sort((a, b) => Number(b === 'struct') - Number(a === 'struct'));
  for (const field of fields) {
    for (let ly = 0; ly < src.height; ly++) {
      for (let lx = 0; lx < src.width; lx++) {
        const v = src.get(field, lx, ly);
        if (v !== sector.get(field, x + lx, y + ly)) sector.set(field, x + lx, y + ly, v);
      }
    }
  }
}
