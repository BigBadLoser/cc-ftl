
import { CrewC, DeadC, PositionC } from '../crew/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { EvaFloatC, SuitC } from './components';
import type { Vehicle } from '../vehicles/components';
import { Struct, isEvaWalkable } from '../structure';
import { suitDef } from './suit';
import { shipById } from '../combat/ships';
import { shipGrid } from '../regions';
import { BodyC } from '../body';
import { VehicleC } from '../vehicles/components';

/** Seats taken on a shuttle: those aboard plus those floating back to it (each will climb in when the drift ends). */
export function seatsTaken(sim: Sim, vehicle: number, v: Vehicle): number {
  let n = v.passengers.length + (v.pilot ? 1 : 0);
  for (const c of sim.world.query(EvaFloatC)) {
    const f = sim.world.get(c, EvaFloatC);
    if (f?.mode === 'back' && f.vehicle === vehicle) n++;
  }
  return n;
}

/** Living crew who left this shuttle in a suit and are still out (the shuttle must wait for them). */
export function outsideCrew(sim: Sim, vehicle: number): number[] {
  return sim.world.query(SuitC, CrewC, PositionC).filter((id) => !sim.world.has(id, DeadC) && sim.world.get(id, SuitC)?.vehicle === vehicle);
}

/** A sector position in tile units (tile (x, y) is centred at sector (x + 0.5, y + 0.5)), or null if the grid has no ship. */
export function tileFrame(sim: Sim, shipId: number, sx: number, sy: number): { x: number; y: number } | null {
  return shipById(sim, shipId) ? { x: sx - 0.5, y: sy - 0.5 } : null;
}

/** The sector position of the centre of a grid's tile (x, y) (the inverse of `tileFrame`), or null if the ship is gone. */
export function tileCentre(sim: Sim, shipId: number, x: number, y: number): { x: number; y: number } | null {
  return shipById(sim, shipId) ? { x: x + 0.5, y: y + 0.5 } : null;
}

/** A grid's exterior tiles (row-major, as x, y pairs), kept per grid view while its struct revision holds. Derived data, never saved. */
const exteriorMemo = new WeakMap<object, { rev: number; tiles: Int32Array }>();

/** The hull ring tiles and open rock ground of a grid (an asteroid base: suited crew land on the plains), in row-major order. */
export function exteriorTiles(grid: NonNullable<ReturnType<typeof shipGrid>>): Int32Array {
  const rev = grid.revision('struct');
  const hit = exteriorMemo.get(grid);
  if (hit && hit.rev === rev) return hit.tiles;
  const out: number[] = [];
  for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
    for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
      const k = grid.get('struct', x, y);
      if ((k === Struct.Space && isEvaWalkable(grid, x, y)) || k === Struct.Ground) out.push(x, y);
    }
  }
  const tiles = Int32Array.from(out);
  exteriorMemo.set(grid, { rev, tiles });
  return tiles;
}

/** The `n` exterior tiles of a grid nearest to a point of its tile frame (ties by row, then column). */
export function nearestExterior(sim: Sim, shipId: number, at: { x: number; y: number }, n: number): { x: number; y: number; d: number }[] {
  const grid = shipGrid(sim, shipId);
  if (!grid?.has('struct')) return [];
  const tiles = exteriorTiles(grid);
  if (n === 1) {
    // One pass for the nearest (the common ask): the same order as the sort below, (d, y, x); row-major input, so a tie keeps the first.
    let best = -1, bd = Infinity;
    for (let i = 0; i < tiles.length; i += 2) {
      const d = Math.hypot((tiles[i] as number) - at.x, (tiles[i + 1] as number) - at.y);
      if (d < bd) [best, bd] = [i, d];
    }
    return best < 0 ? [] : [{ x: tiles[best] as number, y: tiles[best + 1] as number, d: bd }];
  }
  const out: { x: number; y: number; d: number }[] = [];
  for (let i = 0; i < tiles.length; i += 2) {
    const x = tiles[i] as number, y = tiles[i + 1] as number;
    out.push({ x, y, d: Math.hypot(x - at.x, y - at.y) });
  }
  return out.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x).slice(0, n);
}

/** Ticks to drift `dist` tiles. */
export function floatTicks(sim: Sim, dist: number): number {
  return Math.max(1, Math.round((dist / suitDef(sim).floatSpeed) * TICK_HZ));
}

/**
 * The staging tile of a hovering shuttle: the hull tile of the ship it hovers beside nearest to its hatch, within an easy float (suited crew
 * land and board there). Null unless it holds station beside a ship. `at` is a tile of that ship the shuttle came beside on purpose (the
 * crew member a pickup fetches, away/crew.ts `siteSpot`): it is the spot while it is within the easy float, whatever hull is left near it.
 */
export function hatchSpot(sim: Sim, vehicle: number, at?: { x: number; y: number }): { shipId: number; x: number; y: number } | null {
  const v = sim.world.get(vehicle, VehicleC);
  const body = sim.world.get(vehicle, BodyC);
  if (!v || !body || v.state !== 'flying' || v.dest || !v.hover) return null;
  const frame = tileFrame(sim, v.hover, body.x, body.y);
  if (!frame) return null;
  const reach = suitDef(sim).floatRange - 0.75;
  if (at && Math.hypot(at.x - frame.x, at.y - frame.y) <= reach) return { shipId: v.hover, x: at.x, y: at.y };
  const spot = nearestExterior(sim, v.hover, frame, 1)[0];
  return spot && spot.d <= reach ? { shipId: v.hover, x: spot.x, y: spot.y } : null;
}
