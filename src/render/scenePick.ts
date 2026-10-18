import type { Ship } from '../sim/combat/components';
import { Struct } from '../sim/structure';
import type { Camera } from './camera';
import { iso, tileAt } from './iso';
import type { ShipScene } from './shipScene';

export interface PickHost {
  scenes: ReadonlyMap<number, ShipScene>;
  cam: Camera;
  ship(gridId: number): Ship | undefined;
  refId: number;
}

/** Scene ids nearest the viewer first (larger x + y is drawn later, so on top). */
function frontToBack(h: PickHost): number[] {
  return [...h.scenes.keys()].sort((a, b) => {
    const sa = h.ship(a);
    const sb = h.ship(b);
    return (sb ? sb.x + sb.y : 0) - (sa ? sa.x + sa.y : 0);
  });
}

/** Offset of a ship's art origin from the camera ship's, in art px. */
function offset(h: PickHost, gridId: number): { x: number; y: number } {
  const s = h.ship(gridId);
  const r = h.ship(h.refId);
  return s && r ? iso(s.x - r.x, s.y - r.y) : { x: 0, y: 0 };
}

/** The ship tile (any ship) under a canvas-relative CSS px position, preferring ships drawn on top. Space tiles do not count. */
export function pickTileAcross(h: PickHost, sx: number, sy: number): { gridId: number; x: number; y: number } | null {
  const a = h.cam.toArt(sx, sy);
  for (const id of frontToBack(h)) {
    const grid = h.scenes.get(id)?.grid;
    if (!grid) continue;
    const o = offset(h, id);
    const t = tileAt(a.x - o.x, a.y - o.y);
    if (grid.inBounds(t.x, t.y) && grid.get('struct', t.x, t.y) !== Struct.Space) return { gridId: id, x: t.x, y: t.y };
  }
  return null;
}

/** The crew entity (any ship) under a canvas-relative position, or null. */
export function pickCrewAcross(h: PickHost, sx: number, sy: number): number | null {
  const a = h.cam.toArt(sx, sy);
  for (const id of frontToBack(h)) {
    const o = offset(h, id);
    const hit = h.scenes.get(id)?.pickCrew(a.x - o.x, a.y - o.y);
    if (hit !== null && hit !== undefined) return hit;
  }
  return null;
}

/** Canvas-relative CSS px of a tile's centre on any ship (for tooling and focus). */
export function screenOfTile(h: PickHost, ratio: number, gridId: number, x: number, y: number): { x: number; y: number } {
  const o = offset(h, gridId);
  const p = iso(x, y);
  return { x: (h.cam.originX + (p.x + o.x) * h.cam.scale) / ratio, y: (h.cam.originY + (p.y + o.y) * h.cam.scale) / ratio };
}
