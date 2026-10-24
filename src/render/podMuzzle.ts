import { BARREL_PITCH, BARREL_PIVOT_U, BARREL_PIVOT_Z, DIRS, MINE_BOB, POD_HOVER_Z, ROCK_TOP_Z, TIP_AHEAD, TIP_Z } from '../sim/mining/geometry';
import { Z_PX } from './heights';
import { iso } from './iso';

/**
 * The mining pod's laser in the `vehicle.mining_pod.mine.d<k>.f<j>` sprites, in art px from the pod's origin (the sprite's anchor:
 * the pod's centre at the foot of its bell), x right and y down. The projection is the art camera's (iso.ts) applied to the barrel's 3D
 * geometry (sim/mining/geometry.ts): the pivot, the emitter face and the axis the beam continues along. Checked against the sheet:
 * the barrel's on-screen axis in the frames matches this projection within 0.3 degrees and 0.3 px for every visible heading
 * (podMuzzle.test.ts holds the measured tip points). pod_muzzle.py writes the same tip into the manifest as `muzzle`.
 */
type Pt = readonly [number, number];

/** A point `u` tiles ahead of the pod's centre along heading `d` and `z` tiles above its foot, in px from the origin. */
function project(d: number, u: number, z: number): Pt {
  const [dx, dy] = DIRS[d] as readonly [number, number];
  const p = iso(dx * u, dy * u);
  return [p.x, p.y - z * Z_PX];
}

/** The emitter face (the beam's start) and the gimbal pivot of frame `frame` (0 or 1) at heading `d`. */
export function barrel(d: number, frame: number): { pivot: Pt; tip: Pt } {
  const bob = MINE_BOB[frame] ?? 0;
  return { pivot: project(d, BARREL_PIVOT_U, BARREL_PIVOT_Z + bob), tip: project(d, TIP_AHEAD, TIP_Z + bob) };
}

/** Where the beam, continuing along the barrel's axis from the emitter face, meets the rock's top face under the pod's hover height. */
export function beamEnd(d: number, frame: number): Pt {
  const bob = MINE_BOB[frame] ?? 0;
  const t = (TIP_Z + bob - (ROCK_TOP_Z - POD_HOVER_Z)) / Math.sin(BARREL_PITCH);
  return project(d, TIP_AHEAD + t * Math.cos(BARREL_PITCH), ROCK_TOP_Z - POD_HOVER_Z);
}

/** Headings whose barrel the hull hides (it points away from the camera): the beam is drawn behind the pod so only its clear part shows. */
export const HIDDEN: ReadonlySet<number> = new Set(DIRS.flatMap(([x, y], d) => (x + y < -1e-9 ? [d] : [])));
