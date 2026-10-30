import { applyChange, footprintFromGrid, widthViolations, type Footprint, type TileXY } from '../footprint';
import { shipGrid } from '../regions';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { enclosedFloor } from './enclose';

type Tile = TileXY;

const key = (t: Tile): string => `${t.x},${t.y}`;

/**
 * The 3-wide rule for the hull plan (see `footprint.ts`): no part of the ship may be narrower than 3 tiles. It judges hull only (Struts, the
 * yard's scaffolding trusses included, are exempt), as the ship's hull plus the plan's footprint: the planned outline and the floor it shuts in.
 * Only violations the plan ADDS count, so a ship that already breaks the rule (an old template) can still be planned on elsewhere.
 */

/** The ship's hull as a footprint: its structure tiles, beams excluded. */
export function hullFootprint(sim: Sim, ship: number): Footprint {
  const grid = shipGrid(sim, ship);
  return grid ? footprintFromGrid(grid, ship) : { x0: 0, y0: 0, w: 0, h: 0, data: new Uint8Array(0) };
}

/** Violations that adding `add` to `base` creates (tiles the 3x3 opening drops that it did not drop before). */
export function newViolations(base: Footprint, add: readonly Tile[]): Tile[] {
  const old = new Set(widthViolations(base).map(key));
  return widthViolations(base, { add }).filter((t) => !old.has(key(t)));
}

/** The planned footprint of a plan outline: its tiles and the floor they shut in (with the ship's own structure as the rest of the rim). */
export function planFootprint(sim: Sim, outline: readonly Tile[]): Tile[] {
  const seen = new Set(outline.map(key));
  const out = outline.map((t) => ({ x: t.x, y: t.y }));
  for (const t of enclosedFloor(sim, outline)) if (!seen.has(key(t))) out.push(t);
  return out;
}

/** Tiles of the whole plan that break the rule, beyond what the hull already breaks. */
export function planViolations(sim: Sim, ship: number, outline: readonly Tile[]): Tile[] {
  if (outline.length === 0) return [];
  return newViolations(hullFootprint(sim, ship), planFootprint(sim, outline));
}

/** Violations a replan from outline `from` to outline `to` ADDS: the rule's check for one brush stroke (and for `hull.plan`). */
export function changeViolations(sim: Sim, ship: number, from: readonly Tile[], to: readonly Tile[]): Tile[] {
  if (to.length === 0) return [];
  const hull = hullFootprint(sim, ship);
  const old = new Set(widthViolations(from.length ? applyChange(hull, { add: planFootprint(sim, from) }) : hull).map(key));
  return widthViolations(applyChange(hull, { add: planFootprint(sim, to) })).filter((t) => !old.has(key(t)));
}

/** The outline of a planned footprint: its tiles that touch open space (4-neighbour). Hull and other structure shut the rest in, so tiles beside them need no wall. */
export function outlineOf(sim: Sim, footprint: readonly Tile[]): Tile[] {
  const grid = sim.sector.grid;
  const inside = new Set(footprint.map(key));
  const shut = (x: number, y: number): boolean => {
    if (inside.has(`${x},${y}`)) return true;
    const k = grid.get('struct', x, y);
    return k !== Struct.Space && k !== Struct.Beam;
  };
  return footprint.filter((t) => !(shut(t.x + 1, t.y) && shut(t.x - 1, t.y) && shut(t.x, t.y + 1) && shut(t.x, t.y - 1))).map((t) => ({ x: t.x, y: t.y }));
}
