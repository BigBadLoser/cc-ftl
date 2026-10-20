import { Struct } from '../sim/structure';
import type { Camera } from './camera';
import { iso, tileAt, type Pt } from './iso';
import type { Origin } from './sectorPos';
import type { ShipScene } from './shipScene';

/**
 * Picking in the shared world stack (ARCHITECTURE "Sector grid" §7 step 5d). Every region draws in one sector frame, so a
 * canvas point maps to one sector tile, answered by the region that owns it (grids read sector tiles since step 6).
 */
export interface PickHost {
  scenes: ReadonlyMap<number, ShipScene>;
  cam: Camera;
  /** Sector top-left of a grid's region (tiles): where its region-local art sits. */
  origin(shipId: number): Origin;
}

/** The sector tile under an art point (sector frame). */
export function sectorTileAt(a: Pt): Pt {
  return tileAt(a.x, a.y);
}

/** The ship tile (any region) under a canvas-relative CSS px position. Space tiles do not count. */
export function pickTileAcross(h: PickHost, sx: number, sy: number): { shipId: number; x: number; y: number } | null {
  const a = h.cam.toArt(sx, sy);
  // Regions never share tiles (padded frames keep a gap), so at most one owns the sector tile.
  for (const [id, sc] of h.scenes) {
    if (!sc.layers.visible) continue;
    const t = sectorTileAt(a);
    if (sc.grid.inBounds(t.x, t.y) && sc.grid.get('struct', t.x, t.y) !== Struct.Space) return { shipId: id, x: t.x, y: t.y };
  }
  return null;
}

/** The crew entity (any region) under a canvas-relative position: the one whose feet are nearest the viewer. */
export function pickCrewAcross(h: PickHost, sx: number, sy: number): number | null {
  const a = h.cam.toArt(sx, sy);
  let best: number | null = null;
  let bestY = -Infinity;
  for (const [id, sc] of h.scenes) {
    if (!sc.layers.visible) continue;
    const g = h.origin(id);
    const o = iso(g.x, g.y);
    const hit = sc.pickCrew(a.x - o.x, a.y - o.y);
    if (hit && hit.y + o.y > bestY) {
      best = hit.id;
      bestY = hit.y + o.y;
    }
  }
  return best;
}

/** Canvas-relative CSS px of a sector tile's centre (for tooling and focus; `shipId` is kept for the callers). */
export function screenOfTile(h: PickHost, ratio: number, _gridId: number, x: number, y: number): { x: number; y: number } {
  const p = iso(x, y);
  return { x: (h.cam.originX + p.x * h.cam.scale) / ratio, y: (h.cam.originY + p.y * h.cam.scale) / ratio };
}
