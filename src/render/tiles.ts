import { Struct } from "../sim/structure";

export type KindAt = (x: number, y: number) => number;
/** One sprite to draw: the first existing asset id of the chain. */
export type Chain = string[];
/** Wall view mode: up = walls up, auto = cutaway (partitions cut, far hull full), down = shortest (whole hull a ghost rim). */
export type CutawayMode = "auto" | "up" | "down";

const solidish = (k: number) => k === Struct.Wall || k === Struct.Door;
const isRoom = (k: number) => k === Struct.Floor;

export function touchesSpace(kindAt: KindAt, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if ((dx || dy) && kindAt(x + dx, y + dy) === Struct.Space) return true;
  return false;
}

/** Deterministic per-tile hash (the Blender contact sheet mirrors it). */
export function tileHash(x: number, y: number): number {
  const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

/** One main plate; two very subtle variants on ~10% of tiles. Grates, hatches and the rest stay unused in the manifest.
 * Keep in sync with contact_sheet.py. */
export function floorChain(x: number, y: number): Chain {
  const r = (tileHash(x, y) >>> 8) % 20;
  const v = r === 0 ? "c" : r === 1 ? "h" : "a";
  return [`tile.floor.${v}`, "tile.floor.a"];
}

/** One sprite of a wall tile: the first existing asset id of the chain, plus its draw order inside the tile. */
export interface Piece {
  chain: Chain;
  order: number;
  /** Drawn in the under-floor layer (the hull's belly below the deck), so the deck in front hides it. */
  under?: boolean;
}

/** Neighbour mask: bit 1 = N (-y), 2 = E (+x), 4 = S (+y), 8 = W (-x). Walls, hull and doors connect. */
export function wallMask(kindAt: KindAt, x: number, y: number): number {
  return (
    (solidish(kindAt(x, y - 1)) ? 1 : 0) |
    (solidish(kindAt(x + 1, y)) ? 2 : 0) |
    (solidish(kindAt(x, y + 1)) ? 4 : 0) |
    (solidish(kindAt(x - 1, y)) ? 8 : 0)
  );
}

/**
 * Corner fills (walls.py corner_sets): bit 1 = NE, 2 = SE, 4 = SW, 8 = NW. A bit is set when both arms beside that
 * corner are connected and all three tiles round it (the two edge neighbours and the diagonal) are solid wall: a door
 * breaks a thick block. The piece then fills that quadrant, so a thick block is one mass instead of posts and pits.
 */
export function wallCorners(kindAt: KindAt, x: number, y: number, mask: number): number {
  const wall = (dx: number, dy: number) => kindAt(x + dx, y + dy) === Struct.Wall;
  let c = 0;
  if ((mask & 3) === 3 && wall(0, -1) && wall(1, 0) && wall(1, -1)) c |= 1;
  if ((mask & 6) === 6 && wall(1, 0) && wall(0, 1) && wall(1, 1)) c |= 2;
  if ((mask & 12) === 12 && wall(0, 1) && wall(-1, 0) && wall(-1, 1)) c |= 4;
  if ((mask & 9) === 9 && wall(-1, 0) && wall(0, -1) && wall(-1, -1)) c |= 8;
  return c;
}

/** `c<bits>`, or "" for none. */
const cs = (c: number) => (c ? `c${c}` : "");

/** Wall view level of the art (tools/blender/sprites/walls.py LEVELS) for a cutaway mode. */
export type WallLevel = "up" | "cut" | "low";
export const wallLevel = (mode: CutawayMode): WallLevel => (mode === "up" ? "up" : mode === "down" ? "low" : "cut");
const PRE: Record<WallLevel, string> = { up: "full.", cut: "", low: "low." };

/**
 * Which way a hull tile faces space toward the camera: 1 = space at +y, 2 = at +x, 3 = both (the chamfered outer
 * corner), 4 = only diagonally at (+1, +1) (a concave corner), 0 = none (a far hull tile, or not hull at all).
 */
export function outward(kindAt: KindAt, x: number, y: number): number {
  if (!touchesSpace(kindAt, x, y)) return 0;
  const o = (kindAt(x, y + 1) === Struct.Space ? 1 : 0) | (kindAt(x + 1, y) === Struct.Space ? 2 : 0);
  return o || (kindAt(x + 1, y + 1) === Struct.Space ? 4 : 0);
}

/** True if the hull tile at (x, y) draws as a ghost at this level (the near hull always, every hull side in `low`). */
function ghostAt(kindAt: KindAt, x: number, y: number, level: WallLevel): boolean {
  const k = kindAt(x, y);
  return k === Struct.Wall && touchesSpace(kindAt, x, y) && (outward(kindAt, x, y) > 0 || level === "low");
}

/** True if the hull ghost at (x, y) (the near hull, or any hull side in `down`) replaces the floor plate under it. */
export function replacesFloor(kindAt: KindAt, x: number, y: number, mode: CutawayMode = "auto"): boolean {
  return solidish(kindAt(x, y)) && touchesSpace(kindAt, x, y) && (outward(kindAt, x, y) > 0 || wallLevel(mode) === "low");
}

/**
 * Pieces of the wall, hull or door at (x, y), after walls pass 10 (walls.py / hull.py / envtiles.py; the walls art is
 * not final, keep this the one place that maps the grid to wall sprite ids). Three view levels (`wallLevel`):
 *  - up: full-height partitions and far hull; cut: partitions cut above the skirt, the far hull full; low: partition
 *    stubs, every hull side a ghost (see-through edge lines, `tile.hull.ghost.m*[.r*]`).
 *  - The near hull (a hull tile with space at +x / +y / the +x+y diagonal) is a ghost in every level:
 *    `tile.hull.o<outward>.m<mask>` (a flat rim with a lit crest), plus its belly below the deck
 *    `tile.hull.belly.o<outward>.m<mask>` (not for concave corners), drawn under the floor layer (`under`).
 *  - A wall or far hull tile butting into a ghost gets an end face (`tile.<fam>.<pre>end.s|e`).
 *  - Doors are never cut (`tile.door.x|y`); a door in the near hull hangs the belly under it (`tile.hull.drop.s|e`, under).
 *  - Hull plating and bellies use the ochre `.v1` variant on every third diagonal.
 * `ghosts` false (blueprints, roofed ships) draws plain blocks instead of ghosts. `gap(x, y)` marks hull tiles that are
 * not drawn at all because a module's own art stands there (an engine's bulkhead with the walls up or roofed): the
 * hull runs beside it get an end face toward the gap, like toward a ghost.
 */
export function wallPieces(
  kindAt: KindAt,
  x: number,
  y: number,
  kind: number,
  mode: CutawayMode,
  ghosts = true,
  gap: (x: number, y: number) => boolean = () => false,
): Piece[] {
  const level = wallLevel(mode);
  const o = outward(kindAt, x, y);
  if (kind === Struct.Door) {
    const ax = solidish(kindAt(x - 1, y)) && solidish(kindAt(x + 1, y)) ? "x" : "y";
    const out: Piece[] = [{ chain: [`tile.door.${ax}`], order: 0 }];
    if (o && ghosts) out.push({ chain: [`tile.hull.drop.${o & 1 ? "s" : "e"}`], order: 1, under: true });
    return out;
  }
  const mask = wallMask(kindAt, x, y);
  const hull = touchesSpace(kindAt, x, y);
  const v = hull && (((x + y) % 3) + 3) % 3 === 0 ? ".v1" : "";
  const selfGhost = ghosts;
  if (selfGhost && hull && o) {
    const out: Piece[] = [{ chain: [`tile.hull.o${o}.m${mask}`], order: 0 }];
    if (o < 4) out.push({ chain: [`tile.hull.belly.o${o}.m${mask}${v}`, `tile.hull.belly.o${o}.m${mask}`], order: 1, under: true });
    return out;
  }
  if (selfGhost && hull && level === "low") {
    // The rear ghost traces its sloped skirt; `.r<1|8|9>` = which unconnected N / W sides face a room, not space.
    const room = (isRoom(kindAt(x, y - 1)) ? 1 : 0) | (isRoom(kindAt(x - 1, y)) ? 8 : 0);
    // `c2`: the SE diagonal is solid too (a thick block), so the slope does not dip toward it.
    const id = `tile.hull.ghost.m${mask}`;
    const legacy = room ? [`${id}.r${room}`, id] : [id];
    const se = (mask & 6) === 6 && wallCorners(kindAt, x, y, mask) & 2;
    return [{ chain: se ? [...legacy.map((i) => i.replace(id, `${id}c2`)), ...legacy] : legacy, order: 0 }];
  }
  // Corner fills (wallCorners): `m<mask>c<bits>` first, today's `m<mask>` last, so partial art falls back cleanly.
  const c = wallCorners(kindAt, x, y, mask);
  const fam = hull ? "hull" : "wall";
  const pre = `tile.${fam}.${PRE[level]}`;
  const base = `${pre}m${mask}`;
  const chain = c ? [...new Set([`${base}c${c}${v}`, `${base}c${c}`, base + v, base])] : [base + v, base];
  const out: Piece[] = [{ chain, order: 0 }];
  const end = (side: string, bits: number) => (bits ? [`${pre}end.${side}.${cs(bits)}`, `${pre}end.${side}`] : [`${pre}end.${side}`]);
  if (mask & 4 && ((ghosts && ghostAt(kindAt, x, y + 1, level)) || gap(x, y + 1))) out.push({ chain: end("s", c & 6), order: 1 });
  if (mask & 2 && ((ghosts && ghostAt(kindAt, x + 1, y, level)) || gap(x + 1, y))) out.push({ chain: end("e", c & 3), order: 1 });
  return out;
}

/**
 * Tiles carrying a front-ghost vertical edge line (`tile.hull.ghost.vert`, drawn at the tile's front corner): the
 * corners where the near hull's silhouette turns or ends (walls pass 12, complib.ghost_verts).
 */
export function ghostVerts(kindAt: KindAt, width: number, height: number): { x: number; y: number }[] {
  return vertsOver(kindAt, 0, 0, width, height);
}

/**
 * The ghost verts whose tile lies in [x0, x1) x [y0, y1) (one chunk view's share). A vert at tile (x, y) only depends
 * on the hull tiles in [x, x + 1] x [y, y + 1], so the sweep reaches one tile past the rectangle's +x / +y sides.
 */
export function ghostVertsIn(kindAt: KindAt, x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
  return vertsOver(kindAt, x0, y0, x1 + 1, y1 + 1).filter((t) => t.x >= x0 && t.y >= y0 && t.x < x1 && t.y < y1);
}

function vertsOver(kindAt: KindAt, x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
  const seg = new Map<string, { x: number; y: number; dirs: Set<string>; n: number }>();
  const put = (px: number, py: number, d: string) => {
    const k = `${px},${py}`;
    const e = seg.get(k) ?? { x: px, y: py, dirs: new Set<string>(), n: 0 };
    e.dirs.add(d);
    e.n++;
    seg.set(k, e);
  };
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      if (kindAt(x, y) !== Struct.Wall || !touchesSpace(kindAt, x, y)) continue;
      const o = outward(kindAt, x, y);
      const m = wallMask(kindAt, x, y);
      const segs: [number, number, number, number, string][] = [];
      if (o === 1 && m & 8) segs.push([x - 0.5, y + 0.5, x + 0.5, y + 0.5, "y"]);
      if (o === 2 && m & 1) segs.push([x + 0.5, y - 0.5, x + 0.5, y + 0.5, "x"]);
      if (o === 3) segs.push([x - 0.5, y + 0.5, x + 0.5, y - 0.5, "d"]);
      for (const [ax, ay, bx, by, d] of segs) {
        put(ax, ay, d);
        put(bx, by, d);
      }
    }
  return [...seg.values()].filter((e) => e.n === 1 || e.dirs.size > 1).map((e) => ({ x: e.x - 0.5, y: e.y - 0.5 }));
}
