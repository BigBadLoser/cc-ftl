/** Where a base on the ground stands: one owner for the grid's ground tiles and the preview's levelled rock (world.ts). */
import { PAD, type Layout, type Rect } from './layout';

/** Open ground round a prefab base's rectangle: the cliff ring the preview leaves past the template's own margin. */
export const GROUND_RING = 3;

/** The design tiles levelled as ground under and round a base on the ground (null for a design in space). */
export function groundRect(l: Layout): Rect | null {
  if (!l.ground) return null;
  const m = PAD - GROUND_RING;
  return { x: m, y: m, w: l.width - 2 * m, h: l.height - 2 * m };
}
