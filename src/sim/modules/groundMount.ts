import type { ModuleDef } from '../registry';
import { rotatedSize, type Tile } from './footprint';

/**
 * Ground turret mounts (#514): the 3x3 mounts a prefab asteroid base stands its guns and point defence on, out on the rock. The one
 * owner of "is this a ground mount" and of where its cable plugs in.
 */

/** Suffix of a ground mount's def id and asset id: `module.massDriver` -> `module.massDriver.ground`. */
export const GROUND_SUFFIX = '.ground';

/** Whether a def is a ground mount (render and placement both ask here). */
export function isGroundMount(def: Pick<ModuleDef, 'groundMount'> | undefined): boolean {
  return !!def?.groundMount;
}

/** The ground variant's def id of a gun or point-defence def id. */
export const groundMountId = (id: string): string => `${id}${GROUND_SUFFIX}`;

/** Unit step out of the port side per rotation: +x, +y, -x, -y (the port turns clockwise with the sim rotation). */
export const PORT_DIR: readonly (readonly [number, number])[] = [[1, 0], [0, 1], [-1, 0], [0, -1]];

/** The rotation whose port side faces a step (dx, dy) out of a mount's centre: straight along one axis, never diagonal. */
export function rotForPortDir(dx: number, dy: number): number {
  const r = PORT_DIR.findIndex(([x, y]) => x === Math.sign(dx) && y === Math.sign(dy));
  if (r < 0) throw new Error(`rotForPortDir: (${dx}, ${dy}) is not a step along one axis`);
  return r;
}

/**
 * Where a ground mount's cable plugs in: `side` is the footprint's middle tile on the port side, `cable` the ground tile beside it
 * (the cable's first tile) and `dir` the step out.
 */
export function groundPort(def: ModuleDef, m: { x: number; y: number; rot: number }): { side: Tile; cable: Tile; dir: { x: number; y: number } } {
  const [w, h] = rotatedSize(def, m.rot);
  const [dx, dy] = PORT_DIR[((m.rot % 4) + 4) % 4] as readonly [number, number];
  const cx = m.x + Math.floor((w - 1) / 2), cy = m.y + Math.floor((h - 1) / 2);
  const side = { x: dx > 0 ? m.x + w - 1 : dx < 0 ? m.x : cx, y: dy > 0 ? m.y + h - 1 : dy < 0 ? m.y : cy };
  return { side, cable: { x: side.x + dx, y: side.y + dy }, dir: { x: dx, y: dy } };
}
