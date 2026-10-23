/**
 * Where a mining pod hovers to cut a tile, and the laser beam it makes. The sim and the renderer both read these, so the pod's spot
 * and the drawn beam always agree.
 *
 * The pod sprites (tools/blender/sprites/mining_pod.py) carry the laser in a gimbal under the nose: the pivot is `BARREL_PIVOT_U`
 * ahead of the pod's centre and `BARREL_PIVOT_Z` above its foot, and in the mining pose the barrel points down `BARREL_PITCH`
 * degrees along the pod's heading, `BARREL_LEN` long to the emitter face. The beam leaves the emitter along the same axis, so it
 * meets the ore tile's top face (`ROCK_TOP_Z`, the height of rock mass) where that axis crosses it. That fixes the pod's horizontal
 * distance `STANDOFF` from the ore tile's centre for a given hover height (`POD_HOVER_Z`, the pod's foot above the deck).
 * The pod's heading is one of eight (its sprites'), so it sits on one of the eight rays out from the ore.
 */
export const BARREL_PIVOT_U = 0.98;
export const BARREL_PIVOT_Z = 0.54;
export const BARREL_LEN = 0.71;
export const BARREL_PITCH = Math.PI / 3;
/** The two mining frames bob the pod up by these amounts (tiles of height). */
export const MINE_BOB: readonly [number, number] = [0, 0.03];

/** Height of rock mass, the top face the beam ends on (tiles of height). */
export const ROCK_TOP_Z = 1.2;
/** Height of the pod's foot above the deck while it mines (tiles of height). */
export const POD_HOVER_Z = 3;

/** The emitter face, ahead of the pod's centre along its heading (tiles) and above its foot (tiles of height), without the bob. */
export const TIP_AHEAD = BARREL_PIVOT_U + BARREL_LEN * Math.cos(BARREL_PITCH);
export const TIP_Z = BARREL_PIVOT_Z - BARREL_LEN * Math.sin(BARREL_PITCH);

/** Horizontal distance from the pod's centre to the ore tile's centre: the emitter face, plus the axis down to the rock's top face. */
export const STANDOFF = TIP_AHEAD + (POD_HOVER_Z + TIP_Z - ROCK_TOP_Z) / Math.tan(BARREL_PITCH);

/** Unit vectors of the eight headings (sprite direction k points along DIRS[k]; d0 = +x, d2 = +y, turning clockwise on screen). */
const H = Math.SQRT1_2;
export const DIRS: readonly (readonly [number, number])[] = [
  [1, 0], [H, H], [0, 1], [-H, H], [-1, 0], [-H, -H], [0, -1], [H, -H],
];
