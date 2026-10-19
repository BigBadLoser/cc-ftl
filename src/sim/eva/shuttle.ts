import { shipOf } from '../combat/ships';
import { CrewC, DeadC, PositionC } from '../crew/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { SuitC } from '../portals/components';
import type { Vehicle } from '../vehicles/components';
import { vehicleDefOf } from '../vehicles/lifecycle';
import { Struct, isEvaWalkable } from '../structure';
import { suitDef } from './suit';

/** EVA suits stowed aboard a shuttle (its def's `eva.suits` until the first one is used). */
export function vehicleSuits(sim: Sim, v: Vehicle): number {
  return v.suits ?? vehicleDefOf(sim, v)?.eva?.suits ?? 0;
}

/** Living crew who left this shuttle in a suit and are still out (the shuttle must wait for them). */
export function outsideCrew(sim: Sim, vehicle: number): number[] {
  return sim.world.query(SuitC, CrewC, PositionC).filter((id) => !sim.world.has(id, DeadC) && sim.world.get(id, SuitC)?.vehicle === vehicle);
}

/** A sector position in the tile frame of a grid (tile (x, y) is centred at sector (ship.x + x + 0.5, ship.y + y + 0.5)). */
export function tileFrame(sim: Sim, gridId: number, sx: number, sy: number): { x: number; y: number } | null {
  const s = shipOf(sim, gridId);
  return s ? { x: sx - s.x - 0.5, y: sy - s.y - 0.5 } : null;
}

/** The sector position of the centre of a grid's tile (x, y) (the inverse of `tileFrame`), or null if the ship is gone. */
export function tileCentre(sim: Sim, gridId: number, x: number, y: number): { x: number; y: number } | null {
  const s = shipOf(sim, gridId);
  return s ? { x: s.x + x + 0.5, y: s.y + y + 0.5 } : null;
}

/** The `n` exterior tiles of a grid nearest to a point of its tile frame (ties by row, then column). */
export function nearestExterior(sim: Sim, gridId: number, at: { x: number; y: number }, n: number): { x: number; y: number; d: number }[] {
  const grid = sim.grids.get(gridId);
  if (!grid?.has('struct')) return [];
  const out: { x: number; y: number; d: number }[] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (grid.get('struct', x, y) === Struct.Space && isEvaWalkable(grid, x, y)) out.push({ x, y, d: Math.hypot(x - at.x, y - at.y) });
    }
  }
  return out.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x).slice(0, n);
}

/** Ticks to drift `dist` tiles. */
export function floatTicks(sim: Sim, dist: number): number {
  return Math.max(1, Math.round((dist / suitDef(sim).floatSpeed) * TICK_HZ));
}
