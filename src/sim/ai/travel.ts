import { PositionC } from '../crew/components';
import type { Tile } from '../crew/pathfind';
import { traitFlag } from '../crew/traits';
import { airlockDoorAt } from '../modules/airlock';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { isSuited, suitDef } from '../eva/suit';
import { stat } from '../stats';
import { Struct } from '../structure';
import { ModuleC } from '../modules/components';
import { TICK_HZ } from '../time';
import { DOOR_PASS_SEC, FLIGHT_DOCK_SEC } from '../tuning';
import { vehicleDefOf, vehicleSpeedPerTick } from '../vehicles/lifecycle';
import type { Vehicle } from '../vehicles/components';
export { floatTicks } from '../eva/shuttle';

/**
 * Travel-time estimates in ticks (docs/ARCHITECTURE.md "Travel time and air"). Every air decision (admission, the air drive, the departure
 * check) reads times, not steps, so they all use the same table: a tile costs `TICK_HZ / moveSpeed` (suit and traits included, a diagonal
 * is sqrt 2 times that), a plain door `DOOR_PASS_SEC`, an airlock crossing one `cycleSec`. Floats and flights are `floatTicks` / `flightTicks`.
 * Pure, integer results, deterministic: the same inputs give the same ticks.
 */

/** Walking speed in tiles per second for a crew member; `suited` prices a walk they will make in a suit they do not wear yet. */
export function walkSpeed(sim: Sim, walker: number, suited = false): number {
  const base = stat(sim, walker, 'moveSpeed');
  if (!suited || isSuited(sim, walker) || traitFlag(sim, walker, 'noSuitSlow')) return base;
  return base * suitDef(sim).moveMult;
}

/**
 * Extra ticks for landing on this tile: an airlock's outer door costs one cycle (one per crossing, whichever way), any other door its
 * pass time (`DOOR_PASS_SEC`, 0 today: a door swings open as the walker steps into it).
 */
function doorTicks(sim: Sim, shipId: number, tile: Tile): number {
  const grid = shipGrid(sim, shipId);
  if (!grid?.has('struct') || !grid.inBounds(tile.x, tile.y) || grid.get('struct', tile.x, tile.y) !== Struct.Door) return 0;
  const gate = airlockDoorAt(sim, grid, tile.x, tile.y);
  if (!gate) return DOOR_PASS_SEC * TICK_HZ;
  if (gate.door !== 'outer') return 0;
  const m = sim.world.get(gate.id, ModuleC);
  return Math.round((m ? (sim.content.modules[m.def]?.airlock?.cycleSec ?? 0) : 0) * TICK_HZ);
}

/**
 * Ticks for `walker` to walk `steps` (as `findPath` gives them, from the tile `from`, default where they stand) on `shipId`
 * (default their ship). `suited`: price it at suited speed even if the suit is not on yet.
 */
export function travelTicks(sim: Sim, walker: number, steps: readonly Tile[], opts: { from?: Tile; shipId?: number; suited?: boolean } = {}): number {
  const pos = sim.world.get(walker, PositionC);
  const start = opts.from ?? (pos ? { x: pos.x, y: pos.y } : null);
  if (!start || steps.length === 0) return 0;
  const shipId = opts.shipId ?? (pos ? shipIdOf(sim, pos) : 0);
  const perTile = TICK_HZ / Math.max(0.05, walkSpeed(sim, walker, opts.suited));
  let ticks = 0;
  let prev = start;
  for (const s of steps) {
    ticks += perTile * (s.x !== prev.x && s.y !== prev.y ? Math.SQRT2 : 1) + doorTicks(sim, shipId, s);
    prev = s;
  }
  return Math.round(ticks);
}

/** Ticks for a shuttle to fly `dist` sector tiles at its speed (the pilot's skill included), plus the dock or launch time at one end. */
export function flightTicks(sim: Sim, v: Vehicle, dist: number): number {
  const speed = vehicleSpeedPerTick(sim, v);
  if (speed <= 0 || !vehicleDefOf(sim, v)) return Infinity;
  return Math.ceil(dist / speed) + Math.round(FLIGHT_DOCK_SEC * TICK_HZ);
}
