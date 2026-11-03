import { PositionC } from '../crew/components';
import { origin } from '../crew/helpers';
import type { PathGoal, Tile } from '../crew/pathfind';
import { BodyC } from '../body';
import { AirlockC } from '../modules/airlock';
import { ModuleC } from '../modules/components';
import { dijkstraFrom } from '../ai/navSearch';
import { goalTiles, indexOf, inView, isFallbackStop, viewOf, type View } from '../ai/navView';
import { floatTicks, travelTicks } from '../ai/travel';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { REFILL_FILL_SEC } from '../tuning';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { canGive, givesTo } from './airLedger';
import { hatchFace } from './hatch';
import { hatchSpot, tileCentre } from './shuttle';
import { airlockUsable, suitTile } from './suit';

/**
 * Where a suited crew member can fill their tank, found by reachability on their grid (docs/DESIGN.md "Air as a need", #286). Two kinds:
 * the suit tile of a working airlock and the hatch spot of a player shuttle hovering beside the grid, within float range of a hull tile the
 * walker can reach; either counts for a walker while the air ledger says it gives to them (`givesTo`). Part of the air module with `eva/airLedger.ts`: the only
 * place reach to a source is worked out (the air drive, the refill order, admission and the departure check all ask here). The walk is the
 * suited one (`walkOpts` of anyone who can refill: they wear a suit).
 * `ticks` is the time to get there and be ready to fill (a walk, plus the drift out for a shuttle); `fillTicks` is the time at the source
 * (the tank swap, plus the drift back for a shuttle); `steps` is the walk itself, the one timed. Sorted nearest first, then by kind and id.
 */
export interface AirSource {
  kind: 'airlock' | 'vehicle';
  /** The airlock module or the shuttle entity. */
  id: number;
  /** The tile to stand on to fill: the suit tile, or the hull tile the shuttle's hatch spot is. */
  tile: Tile;
  ticks: number;
  fillTicks: number;
  steps: Tile[];
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
function sourceCandidates(sim: Sim, shipId: number, without = 0): Candidate[] {
  const out: Candidate[] = [];
  const fill = Math.round(REFILL_FILL_SEC * TICK_HZ);
  for (const id of sim.world.query(AirlockC)) {
    const at = suitTile(sim, id);
    if (!at || !airlockUsable(sim, id) || shipIdOf(sim, sim.world.get(id, ModuleC)) !== shipId) continue;
    if (canGive(sim, { kind: 'airlock', id }, without)) out.push({ kind: 'airlock', id, tile: at, extra: 0, fill });
  }
  return out.concat(hoverCandidates(sim, shipId, without, fill));
}

function hoverCandidates(sim: Sim, shipId: number, without: number, fill: number): Candidate[] {
  const out: Candidate[] = [];
  for (const id of sim.world.query(VehicleC)) {
    const v = sim.world.get(id, VehicleC) as Vehicle;
    if (v.hover !== shipId || !canGive(sim, { kind: 'vehicle', id }, without)) continue;
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
  const cands = sourceCandidates(sim, shipId, opts.without ?? 0).filter((c) => givesTo(sim, c, crew, opts.without));
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
    const steps = r.steps(k);
    out.push({ kind: c.kind, id: c.id, tile: c.tile, ticks: travelTicks(sim, crew, steps, { shipId, suited: true }) + c.extra, fillTicks: c.fill, steps });
  });
  return out.sort((a, b) => a.ticks - b.ticks || (a.kind === b.kind ? a.id - b.id : a.kind === 'airlock' ? -1 : 1));
}

/** The nearest source, or null. */
export function nearestAirSource(sim: Sim, crew: number, opts: { without?: number } = {}): AirSource | null {
  return airSources(sim, crew, opts)[0] ?? null;
}

/**
 * Ticks from given tiles of a grid back to their nearest source, for many walkers and tiles at once (admission asks for every job's work
 * tile): one search out of each source to the tiles of `goals`, made the first time the grid is asked about. Same sources and walk as
 * `airSources`, run backwards; a tile no source reaches gets null. The searches are shared by every walker, so each keeps its source and
 * the source is asked per walker (`givesTo`): one whose air is all held for others is no way back for them (Codex 4450094854).
 */
export class SourceReach {
  private byShip = new Map<number, { view: View; from: { r: ReturnType<typeof dijkstraFrom>; src: Candidate }[] } | null>();
  constructor(
    private sim: Sim,
    private goals: (ship: number) => readonly PathGoal[],
  ) {}

  /** Ticks for `walker` from `tile` on `ship` to its nearest source, or null. */
  ticksFrom(walker: number, ship: number, tile: Tile): number | null {
    const reach = this.reachOf(ship);
    if (!reach) return null;
    const key = indexOf(reach.view, tile.x, tile.y);
    let best: number | null = null;
    for (const { r, src } of reach.from) {
      if (!r.cost.has(key) || !givesTo(this.sim, src, walker)) continue;
      const path = r.steps(key); // from the source to the tile
      const back = [...path.slice(0, -1).reverse(), src.tile];
      const ticks = travelTicks(this.sim, walker, back, { from: path.length ? (path[path.length - 1] as Tile) : src.tile, shipId: ship, suited: true }) + src.extra;
      if (best === null || ticks < best) best = ticks;
    }
    return best;
  }

  private reachOf(ship: number) {
    if (this.byShip.has(ship)) return this.byShip.get(ship)!;
    const view = viewOf(this.sim, ship, { suited: true });
    const sources = view ? sourceCandidates(this.sim, ship) : [];
    let made: { view: View; from: { r: ReturnType<typeof dijkstraFrom>; src: Candidate }[] } | null = null;
    if (view && sources.length > 0) {
      const goals = new Map<number, number[]>();
      const fallbacks = new Map<number, number[]>();
      for (const g of this.goals(ship)) {
        for (const t of goalTiles(view, g)) (isFallbackStop(view, g, t) ? fallbacks : goals).set(t, [t]); // keyed by tile
      }
      made = { view, from: sources.map((src) => ({ r: dijkstraFrom(view, src.tile, goals, fallbacks), src })) };
    }
    this.byShip.set(ship, made);
    return made;
  }
}
