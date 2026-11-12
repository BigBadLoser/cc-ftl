import { footprintTiles } from '../sim/modules/footprint';
import type { ModuleDef } from '../sim/registry';

/** Facing (clip row) toward the camera: between +x (SE, 4) and +y (SW, 6). A patient in the tank faces out through the glass. */
export const POD_DIR = 5;

/**
 * Art px a patient floats above the floor point of the pod's centre: the stage of the plinth, plus the fluid they hang in. Tuned on the sprites
 * (the pod's tank floor sits about 14 art px over the floor point; the figure hangs a few px clear of it).
 */
export const POD_LIFT = 18;

/** Where a patient floats in a recovery pod: the centre of its footprint, in sector tiles, upright and facing the camera. */
export function podPose(def: ModuleDef, x: number, y: number, rot: number): { x: number; y: number; dir: number } {
  const tiles = footprintTiles(def, x, y, rot);
  return { x: tiles.reduce((a, t) => a + t.x, 0) / tiles.length, y: tiles.reduce((a, t) => a + t.y, 0) / tiles.length, dir: POD_DIR };
}
