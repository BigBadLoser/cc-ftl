import type { ModuleDef } from '../sim/registry';
import { footprintTiles } from '../sim/modules/footprint';

/** Facing (sleep clip row) whose head lies toward each grid direction: -y (screen NE), +x (SE), +y (SW), -x (NW). */
const HEAD_DIR = { negY: 2, posX: 4, posY: 6, negX: 0 } as const;

/**
 * Art px a sleeper is raised above the floor point of the bed's centre. Measured at the 128x64 tile (world px): the mattress top
 * at the centre of `module.bed` is 16 px above the floor point (bed sprite column through the centre: top surface
 * midpoint at row 68, floor point row 84), and the `sleep` frames already rest their underside at the body's centre
 * 8 px above their anchor (4 to 11 over the headings), so the lift is the difference, 8 world px = 4 art px.
 */
export const BED_LIFT = 4;

/**
 * Art px each berth above the first sits higher (the double bunk's upper deck over its lower one). Measured on `module.bunk.r0` (centre column, mattress top
 * midpoints against the footprint centre's floor point): lower 8.5 art px, upper 41.5, so the upper deck is 33 higher (tools/blender/sprites/bunk_study.py b1h:
 * deck tops 5 and 38 px, art px 1:1).
 */
export const BERTH_RISE = 33;

/** The lift (art px) of a sleeper in berth `berth` of a bed: the mattress top over the `sleep` frames' rest height. */
export const berthLift = (berth: number): number => BED_LIFT + Math.max(0, berth) * BERTH_RISE;

/**
 * Tiles the sleeper lies toward the foot of the bed from the footprint's centre. The `sleep` frames are not centred on their
 * anchor: they reach 0.99 tiles toward the head and 0.82 toward the feet (measured on the posed rig), so centred the head
 * went through the head board. This centres the body on the mattress. tools/blender/sprites/bed_front.py uses the same.
 */
export const SLEEP_SHIFT = 0.09;

/** The unit step toward the head per `sleep` row (HEAD_DIR values). */
const HEAD_STEP: Record<number, readonly [number, number]> = { 2: [0, -1], 4: [1, 0], 6: [0, 1], 0: [-1, 0] };

export interface BedPose {
  /** Where the sleeper lies: the centre of the bed's footprint moved SLEEP_SHIFT toward the foot, in sector tiles. */
  x: number;
  y: number;
  /** Row of the `sleep` clip: the head toward the pillow. */
  dir: number;
}

/**
 * How a sleeper lies on a bed module: centred on its mattress (SLEEP_SHIFT), along its long axis, head on the pillow. `rotated`: the
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
  const [hx, hy] = HEAD_STEP[dir] ?? [0, 0];
  return { x: cx - hx * SLEEP_SHIFT, y: cy - hy * SLEEP_SHIFT, dir };
}
