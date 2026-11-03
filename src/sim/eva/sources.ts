import { PositionC } from '../crew/components';
import { origin } from '../crew/helpers';
import type { Tile } from '../crew/pathfind';
import { BodyC } from '../body';
import { vehicleFaction } from '../vehicles/lifecycle';
import { AirlockC } from '../modules/airlock';
import { ModuleC } from '../modules/components';
import { dijkstraFrom } from '../ai/navSearch';
import { indexOf, inView, viewOf } from '../ai/navView';
import { floatTicks, travelTicks } from '../ai/travel';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { REFILL_FILL_SEC } from '../tuning';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { airlockAir, airlockSupply, dockedSupplier, hasTank, vehicleAir } from './air';
import { hatchFace } from './hatch';
import { hatchSpot, tileCentre } from './shuttle';
import { airlockUsable, suitTile } from './suit';

/**
 * Where a suited crew member can fill their tank, found by reachability on their grid (docs/DESIGN.md "Air as a need", #286). Two kinds:
 * the suit tile of a working airlock that has air in its store (or a player shuttle docked there with a tank to give), and the hatch spot of
 * a player shuttle hovering beside the grid, within float range of a hull tile the walker can reach, with at least one tank in its store.
 * `ticks` is the time to get there and be ready to fill (a walk, plus the drift out for a shuttle); `fillTicks` is the time at the source
 * (the tank swap, plus the drift back for a shuttle). Sorted nearest first, then by kind and id.
 */
export interface AirSource {
  kind: 'airlock' | 'vehicle';
  /** The airlock module or the shuttle entity. */
  id: number;
  /** The tile to stand on to fill: the suit tile, or the hull tile the shuttle's hatch spot is. */
  tile: Tile;
  ticks: number;
  fillTicks: number;
}

/** A candidate before the walk is searched. */
interface Candidate {
  kind: AirSource['kind'];
  id: number;
  tile: Tile;
  /** Ticks the source adds after the walk to be ready to fill, and the time to fill. */
  extra: number;
  fill: number;
}

/** Drift distance (sector tiles) from a hull tile to the shuttle's hatch face; the same line `eva` floats along. */
function driftDist(sim: Sim, vehicle: number, spot: { shipId: number; x: number; y: number }): number {
  const body = sim.world.get(vehicle, BodyC);
  const land = tileCentre(sim, spot.shipId, spot.x, spot.y);
  if (!body || !land) return 0;
  const face = hatchFace(body, land);
  return Math.hypot(land.x - face.x, land.y - face.y);
}

/** The sources on a grid that have air to give, before any reachability test. `without` leaves one shuttle out (the departure check). */
export function sourceCandidates(sim: Sim, shipId: number, without = 0): Candidate[] {
  const out: Candidate[] = [];
  const fill = Math.round(REFILL_FILL_SEC * TICK_HZ);
  for (const id of sim.world.query(AirlockC)) {
    const at = suitTile(sim, id);
    if (!at || !airlockUsable(sim, id) || shipIdOf(sim, sim.world.get(id, ModuleC)) !== shipId) continue;
    // A shuttle docked here gives from its own store when the airlock's is empty.
    const v = dockedSupplier(sim, id, without);
    if (airlockAir(sim, id) > 0 || (v && hasTank(sim, vehicleAir(sim, v)))) out.push({ kind: 'airlock', id, tile: at, extra: 0, fill });
  }
  return out.concat(hoverCandidates(sim, shipId, without, fill));
}

function hoverCandidates(sim: Sim, shipId: number, without: number, fill: number): Candidate[] {
  const out: Candidate[] = [];
  for (const id of sim.world.query(VehicleC)) {
    const v = sim.world.get(id, VehicleC) as Vehicle;
    if (id === without || v.hover !== shipId || vehicleFaction(sim, v) !== 'player' || !hasTank(sim, vehicleAir(sim, v))) continue;
    const spot = hatchSpot(sim, id);
    if (!spot) continue;
    const drift = floatTicks(sim, driftDist(sim, id, spot));
    out.push({ kind: 'vehicle', id, tile: { x: spot.x, y: spot.y }, extra: drift, fill: fill + drift });
  }
  return out;
}

/**
 * Every source this crew member can reach, nearest first. One multi-goal search over the suited view (a suited walker, or one who will be).
 * Empty for a crew member off any grid.
 */
export function airSources(sim: Sim, crew: number, opts: { without?: number } = {}): AirSource[] {
  const pos = sim.world.get(crew, PositionC);
  if (!pos) return [];
  const shipId = shipIdOf(sim, pos);
  const cands = sourceCandidates(sim, shipId, opts.without ?? 0);
  const view = cands.length > 0 ? viewOf(sim, shipId, { suited: true }) : null;
  if (!view || !shipGrid(sim, shipId)) return [];
  const goals = new Map<number, number[]>();
  cands.forEach((c, k) => {
    if (!inView(view, c.tile.x, c.tile.y)) return;
    const i = indexOf(view, c.tile.x, c.tile.y);
    goals.set(i, [...(goals.get(i) ?? []), k]);
  });
  const r = dijkstraFrom(view, origin(pos), goals);
  const out: AirSource[] = [];
  cands.forEach((c, k) => {
    if (!r.cost.has(k)) return;
    const walk = travelTicks(sim, crew, r.steps(k), { shipId, suited: true });
    out.push({ kind: c.kind, id: c.id, tile: c.tile, ticks: walk + c.extra, fillTicks: c.fill });
  });
  return out.sort((a, b) => a.ticks - b.ticks || (a.kind === b.kind ? a.id - b.id : a.kind === 'airlock' ? -1 : 1));
}

/**
 * Seconds of air the source can give: an airlock's `airlockSupply` (its store, then a player shuttle docked there), a shuttle's store.
 * `without` leaves one shuttle out, as for `airSources`. What the departure check budgets; the refill draws from the same stores.
 */
export function sourceSupply(sim: Sim, s: Pick<AirSource, 'kind' | 'id'>, without = 0): number {
  if (s.kind === 'airlock') return airlockSupply(sim, s.id, without);
  const v = s.id !== without ? sim.world.get(s.id, VehicleC) : undefined;
  return v ? vehicleAir(sim, v) : 0;
}

/** The nearest source, or null. */
export function nearestAirSource(sim: Sim, crew: number, opts: { without?: number } = {}): AirSource | null {
  return airSources(sim, crew, opts)[0] ?? null;
}
