import type { TubeRun } from '../sim/tube';

/**
 * A prefab base tube's art (tools/blender/sprites/tube_study.py, sheet tube; #508). Each part is a sprite anchored at its own tile
 * (sector tiles here), sorted by that tile's depth plus `dz`:
 *
 *  - the far port `tube.port.e|s[.roofed][.open]` on the first floor tile: the block on the far module's wall, the hatch in its bore
 *    open with the door; roofed, the one cut against the module's hull, its shoulders over the hull's top. The grid leaves the door's
 *    own art out; the walls either side keep the module's hull, cut with the view (`tubeTiles`).
 *  - the glass `tube.<axis>.<part>` on every floor tile: west|north, mid, east|south, or `one` for a one-tile tube: its walkway, belly
 *    and far half of the shell, under the crew in it; and `.front`, the camera's half of the glass with its ribs, over them. The
 *    tile takes no floor, and the walls beside it no art (the region's tile art sees them as outside, regionTiles.ts).
 *  - the near port `tube.port.w|n` on the last floor tile, over its glass and the crew there (the ring faces the camera).
 *  - unroofed, the near junction `tube.junction.w|n[.open]` (the inboard frame and hatch through the near module's back wall) at the
 *    near door's front tile; the grid draws no wall on the door and its two neighbours then. Roofed, they are the hull's. Two
 *    layers either side of crew in the door: the bore, hatch and floors under them, from the door tile's far edge; `.front`, the
 *    room face with its frame, over them up to the door's middle (crew past it stand in the room, in front of it).
 *
 * Back to front: the far port and the glass's back layer, all just under the crew on their tiles; the glass's front
 * layer and the near port over the crew; the junction's back, then its front over crew in the door.
 */
export interface TubePiece {
  id: string;
  /** Sector tile the sprite is anchored at. */
  x: number;
  y: number;
  dz: number;
}

export interface TubeLook {
  roofed: boolean;
  /** Whether the door at that end of the run stands open. */
  farOpen: boolean;
  nearOpen: boolean;
}

const SEG: Record<'x' | 'y', [string, string]> = { x: ['west', 'east'], y: ['north', 'south'] };
/**
 * The glass's front layer over its tile's depth: over every crew member whose figure reaches its tile (a figure sorts at its own
 * position's depth and spans under a tile either way along the run), and under the next tile's back layer. The last tile's stops
 * at the tube's end: crew past it, in the near door, stand in front of the glass.
 */
const FRONT = 0.9;
const FRONT_END = 0.5;

/** The sprites of one tube run, back to front. */
export function tubePieces(r: TubeRun, v: TubeLook): TubePiece[] {
  const x = r.axis === 'x', dx = x ? 1 : 0, dy = 1 - dx;
  const out: TubePiece[] = [];
  out.push({ id: `tube.port.${x ? 'e' : 's'}${v.roofed ? '.roofed' : ''}${v.farOpen ? '.open' : ''}`, x: r.x, y: r.y, dz: -0.02 });
  const [first, last] = SEG[r.axis];
  for (let k = 0; k < r.len; k++) {
    const part = r.len === 1 ? 'one' : k === 0 ? first : k === r.len - 1 ? last : 'mid';
    out.push({ id: `tube.${r.axis}.${part}`, x: r.x + dx * k, y: r.y + dy * k, dz: -0.01 });
    out.push({ id: `tube.${r.axis}.${part}.front`, x: r.x + dx * k, y: r.y + dy * k, dz: k === r.len - 1 ? FRONT_END : FRONT });
  }
  out.push({ id: `tube.port.${x ? 'w' : 'n'}`, x: r.near.x - dx, y: r.near.y - dy, dz: FRONT_END + 0.005 });
  if (!v.roofed) {
    // (at the door's front tile, one deeper than the door: the back just over the near port, the front just past the door's middle)
    const id = `tube.junction.${x ? 'w' : 'n'}${v.nearOpen ? '.open' : ''}`, at = { x: r.near.x + dy, y: r.near.y + dx };
    out.push({ id, ...at, dz: -1.49 }, { id: `${id}.front`, ...at, dz: -0.98 });
  }
  return out;
}

/**
 * The module wall tiles a run's art stands on (sector tiles): the far door (the port's own; no door art), its two neighbours (the
 * port's block stands across them: their hull takes its base piece and sorts under the tube's art), and the near door with its
 * two neighbours (the junction's, unroofed: no wall art).
 */
export function tubeTiles(r: TubeRun): { port: { x: number; y: number }; row: { x: number; y: number }[]; junction: { x: number; y: number }[] } {
  const dx = r.axis === 'x' ? 1 : 0, dy = 1 - dx;
  const across = (t: { x: number; y: number }) => [{ x: t.x - dy, y: t.y - dx }, { x: t.x + dy, y: t.y + dx }];
  return { port: r.far, row: across(r.far), junction: [r.near, ...across(r.near)] };
}
