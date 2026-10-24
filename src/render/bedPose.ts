import type { ModuleDef } from '../sim/registry';
import { footprintTiles } from '../sim/modules/footprint';

/** Facing (sleep clip row) whose head lies toward each grid direction: -y (screen NE), +x (SE), +y (SW), -x (NW). */
const HEAD_DIR = { negY: 2, posX: 4, posY: 6, negX: 0 } as const;

/**
 * 1x art px a sleeper is raised above the floor point of the bed's centre. Measured on the 2x sheets: the mattress top
 * at the centre of `module.bed` is 16 px above the floor point (bed sprite column through the centre: top surface
 * midpoint at row 68, floor point row 84), and the `sleep` frames already rest their underside at the body's centre
 * 8 px above their anchor (4 to 11 over the headings), so the lift is the difference, 8 px = 4 at 1x.
 */
export const BED_LIFT = 4;

export interface BedPose {
  /** Where the sleeper lies: the centre of the bed's footprint, in sector tiles. */
  x: number;
  y: number;
  /** Row of the `sleep` clip: the head toward the pillow. */
  dir: number;
}

/**
 * How a sleeper lies on a bed module: centred on its footprint, along its long axis, head on the pillow. `rotated`: the
 * bed has its own sprite per rotation (`<asset>.r<n>`), so the pillow turns with it (r0 -y, then clockwise: r1 +x, r2 +y,
 * r3 -x). Without them the one sprite is drawn as is at r0/r2 (pillow at the -y end) and mirrored at r1/r3 (pillow at the
 * -x end; moduleView), and the sleeper follows what is drawn.
 */
export function bedPose(def: ModuleDef, x: number, y: number, rot: number, rotated: boolean): BedPose {
  const tiles = footprintTiles(def, x, y, rot);
  const cx = tiles.reduce((a, t) => a + t.x, 0) / tiles.length;
  const cy = tiles.reduce((a, t) => a + t.y, 0) / tiles.length;
  const r = ((rot % 4) + 4) % 4;
  const turned: readonly number[] = [HEAD_DIR.negY, HEAD_DIR.posX, HEAD_DIR.posY, HEAD_DIR.negX];
  const dir = rotated ? (turned[r] as number) : r % 2 === 0 ? HEAD_DIR.negY : HEAD_DIR.negX;
  return { x: cx, y: cy, dir };
}
