/**
 * Where the mining laser's barrel tip is in the `vehicle.mining_pod.mine.d<k>.f<j>` sprites, in art px from each frame's anchor
 * (`MUZZLE[k][j] = [x, y]`). Measured from the sheet: the last opaque pixel along the barrel's axis (the gimbal pivot to the emitter
 * face, projected through the art's iso camera). Two headings are special: d1's barrel runs out of the frame (the sheet clips it at
 * the bottom edge, so its tip is the projected point, 66 px under the anchor), and d4, d5 and d6 turn the barrel away from the camera
 * so the hull hides it (`HIDDEN`); their points are the projected tip behind the hull. Stand-in until pod_family.py writes a `muzzle`
 * into the manifest (tools/blender/sprites/pod_muzzle.py, the same projection); then read that instead.
 */
export const MUZZLE: readonly (readonly (readonly [number, number])[])[] = [
  [[86, 51], [86, 48]],
  [[0, 66], [0, 64]],
  [[-86, 51], [-86, 49]],
  [[-124, 11], [-124, 9]],
  [[-85, -37], [-85, -39]],
  [[0, -55], [0, -57]],
  [[85, -37], [85, -39]],
  [[124, 10], [124, 8]],
];

/** Headings whose barrel is hidden behind the hull: the beam is drawn behind the pod so it only shows once it clears the hull. */
export const HIDDEN: ReadonlySet<number> = new Set([4, 5, 6]);
