import { footprintTiles } from '../sim/modules/footprint';
import { facingOf } from '../sim/crew/helpers';
import type { ModuleDef } from '../sim/registry';

/** Facing (clip row) toward the camera: the grid step (+1,+1) points straight down the screen (row 1; row 5 is its opposite, the back). A patient faces out through the glass at every rotation. */
export const POD_DIR = facingOf(1, 1);

/**
 * Art px a patient floats above the floor point of the pod's centre: the stage of the plinth, plus the fluid they hang in. Tuned on the sprites
 * (the pod's tank floor sits about 14 art px over the floor point; the figure hangs a few px clear of it).
 */
export const POD_LIFT = 14;

/** Where a patient floats in a recovery pod: the centre of its footprint, in sector tiles, upright and facing the camera. */
export function podPose(def: ModuleDef, x: number, y: number, rot: number): { x: number; y: number; dir: number } {
  const tiles = footprintTiles(def, x, y, rot);
  return { x: tiles.reduce((a, t) => a + t.x, 0) / tiles.length, y: tiles.reduce((a, t) => a + t.y, 0) / tiles.length, dir: POD_DIR };
}
