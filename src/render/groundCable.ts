import { hash } from './assets/palette';

/**
 * The ground power cable's art (#514): a duct laid over asteroid ground between base modules no hull joins, one sprite
 * per tile in sheet `cable` (`tools/blender/sprites/cable_duct.py`):
 *
 *   cable.duct.m<mask>[.w<walls>][.v1-4][.off]
 *
 * mask: the sides the duct leaves by (N -y 1, E +x 2, S +y 4, W -x 8), to more cable or into a module or wall; walls: the
 * subset that plugs into a module or wall (a socket plate on that edge, drawn in the same sprite). Straight runs with no
 * wall (mask 5 or 10) have fittings `.v1`-`.v4` (a hatch, a vent grille, a breaker box, anchor brackets); the rest show a
 * plain lid. `.off`: unpowered, the lamps dark. Anchored at the tile centre, footprint 1x1, drawn at the tile's depth.
 */

/** What lies beside a cable tile on one side: more cable, a module or wall the cable plugs into, or neither. */
export type CableSide = 'cable' | 'wall' | null;

/** The fittings a straight run can carry: `.v1`..`.v<CABLE_FITTINGS>`. */
export const CABLE_FITTINGS = 4;
/** One plain straight in this many carries a fitting. */
const FITTING_EVERY = 4;

/** Side bits in mask order with their offsets: N (-y) 1, E (+x) 2, S (+y) 4, W (-x) 8. */
const SIDES = [
  [1, 0, -1],
  [2, 1, 0],
  [4, 0, 1],
  [8, -1, 0],
] as const;

/** Sprite id of the cable tile at (x, y). `sideAt(dx, dy)` says what lies on each side; the fitting on a straight run comes
 * from a tile hash, so a long run doesn't repeat and a tile keeps its fitting from frame to frame. */
export function cableTileId(sideAt: (dx: number, dy: number) => CableSide, x: number, y: number, powered: boolean): string {
  let mask = 0;
  let walls = 0;
  for (const [bit, dx, dy] of SIDES) {
    const s = sideAt(dx, dy);
    if (s) mask |= bit;
    if (s === 'wall') walls |= bit;
  }
  let fitting = '';
  if ((mask === 5 || mask === 10) && !walls) {
    const h = hash(x * 7919 + y * 104729, 11) % (CABLE_FITTINGS * FITTING_EVERY);
    if (h < CABLE_FITTINGS) fitting = `.v${h + 1}`;
  }
  return `cable.duct.m${mask}${walls ? `.w${walls}` : ''}${fitting}${powered ? '' : '.off'}`;
}
