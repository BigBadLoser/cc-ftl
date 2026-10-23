import { CrewC, DraftedC, JobC, PositionC } from '../crew/components';
import { EvaFloatC, SuitC } from '../eva/components';
import { outsideCrew, tileFrame } from '../eva/shuttle';
import { BodyC } from '../body';
import { Struct } from '../structure';
import { makeHaul } from '../items/plan';
import { spillItems, takeFromStack } from '../items/stacks';
import { nearestSource, refKey, reservations } from '../items/stock';
import { storageAdd, storageTake } from '../items/storage';
import { ItemStackC, StorageC } from '../items/components';
import { ModuleC } from '../modules/components';
import { isTileWalkable } from '../modules/walk';
import { shipById } from '../combat/ships';
import { shipGrid, shipIdAt, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { DEFAULT_CARRY_CAPACITY, PLAN_INTERVAL } from '../tuning';
import { cargoAdd, cargoCount, cargoOf, cargoTake } from '../vehicles/cargo';
import { AboardC, EmbarkOrderC, VehicleC, type Vehicle } from '../vehicles/components';
import { boardingTile, cargoTile } from '../vehicles/geometry';
import { occupants, unboardCrew } from '../vehicles/lifecycle';
import { FerryC, type Ferry } from './components';
import { settleTransfer } from '../logistics/settle';
import { ferryMode, isFerryRegion, isPickupRegion, regionAirlock } from './pick';

/** Ticks between repeats of an order a run keeps asking for until the shuttle obeys. */
const REPEAT = 20;
/** Seconds a leg may take, loading may take before crew fall back to an instant swap, and boarding or landing may take. */
const FLIGHT_SEC = 240;
const HAUL_SEC = 90;
const CREW_SEC = 90;

const due = (f: Ferry): boolean => f.timer % REPEAT === 1;
const sec = (n: number): number => n * TICK_HZ;

function go(f: Ferry, phase: Ferry['phase']): void {
  f.phase = phase;
  f.timer = 0;
}

function abort(f: Ferry, reason: NonNullable<Ferry['reason']>): void {
  f.reason ??= reason;
  f.crew = f.crew.filter(() => false);
  go(f, 'home');
}

/** Which region a vehicle is docked at (0 = none). */
function dockedAt(sim: Sim, v: Vehicle): number {
  return v.state === 'docked' ? shipIdOf(sim, sim.world.get(v.dock, ModuleC)) : 0;
}

/** True when the shuttle is at `region`: docked at one of its airlocks, or hovering beside it. Otherwise asks it to go. */
function arrive(sim: Sim, id: number, v: Vehicle, f: Ferry, region: number): boolean {
  if (dockedAt(sim, v) === region) return true;
  if (v.state === 'flying' && !v.dest && v.hover === region) return true;
  if (f.timer > sec(FLIGHT_SEC)) return abort(f, 'timeout'), false;
  if (!due(f)) return false;
  if (v.state === 'docked') return sim.enqueue({ type: 'vehicle.undock', vehicle: id }), false;
  const mode = ferryMode(sim, region, id);
  if (!mode) return abort(f, 'noAirlock'), false;
  if (mode === 'dock') {
    if (v.dest?.type !== 'dock') sim.enqueue({ type: 'vehicle.dock', vehicle: id, airlock: regionAirlock(sim, region, id) });
  } else if (v.dest?.type !== 'hover' || v.dest.ship !== region) sim.enqueue({ type: 'vehicle.hover', vehicle: id, ship: region });
  return false;
}

/** Take items out of a region's storage into the hold at once (the hover swap, and the fallback for a dock nobody can haul at). */
function takeInstant(sim: Sim, id: number, region: number, f: Ferry): void {
  for (const l of f.items) {
    let need = l.count - cargoOf(sim, id, l.item);
    for (const sid of [...sim.world.query(StorageC, ModuleC)].sort((a, b) => a - b)) {
      if (need <= 0) break;
      if (shipIdOf(sim, sim.world.get(sid, ModuleC)) !== region) continue;
      const got = storageTake(sim, sid, l.item, need);
      const fit = cargoAdd(sim, id, l.item, got);
      if (fit < got) storageAdd(sim, sid, l.item, got - fit);
      need -= fit;
    }
    for (const stack of [...sim.world.query(ItemStackC)].sort((a, b) => a - b)) {
      const st = sim.world.get(stack, ItemStackC);
      if (need <= 0) break;
      if (!st || st.item !== l.item || shipIdAt(sim, st.x, st.y) !== region) continue;
      const got = takeFromStack(sim, stack, need);
      const fit = cargoAdd(sim, id, l.item, got);
      if (fit < got) spillItems(sim, region, st.x, st.y, l.item, got - fit);
      need -= fit;
    }
  }
}

/** Where loose goods go down at the destination: inside the docked airlock, or the walkable tile nearest the hover point. */
function dropPoint(sim: Sim, id: number, region: number): { x: number; y: number } | null {
  const v = sim.world.get(id, VehicleC) as Vehicle;
  if (v.state === 'docked') {
    const at = boardingTile(sim, id);
    return at && at.shipId === region ? at : null;
  }
  const body = sim.world.get(id, BodyC);
  const grid = shipGrid(sim, region);
  const frame = body && tileFrame(sim, region, body.x, body.y);
  if (!frame || !grid?.has('struct')) return null;
  let best: { x: number; y: number; d: number } | null = null;
  for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
    for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
      const k = grid.get('struct', x, y);
      if (k !== Struct.Floor && k !== Struct.Ground) continue;
      if (!isTileWalkable(sim, grid, x, y)) continue;
      const d = Math.hypot(x - frame.x, y - frame.y);
      if (!best || d < best.d) best = { x, y, d };
    }
  }
  return best;
}

/** Put the hold into the region's storage at once, the rest down as loose floor stacks. Returns the units that found no room. */
function dropInstant(sim: Sim, id: number, region: number): number {
  const v = sim.world.get(id, VehicleC) as Vehicle;
  for (const q of [...v.cargo]) {
    let left = q.count;
    for (const sid of [...sim.world.query(StorageC, ModuleC)].sort((a, b) => a - b)) {
      if (left <= 0) break;
      if (shipIdOf(sim, sim.world.get(sid, ModuleC)) !== region) continue;
      left -= storageAdd(sim, sid, q.item, left);
    }
    cargoTake(sim, id, q.item, q.count - left);
  }
  // No storage with room (a freshly claimed base has none): down on the floor, where the ordinary hauls find it.
  const at = cargoCount(v) > 0 ? dropPoint(sim, id, region) : null;
  if (at) {
    for (const q of [...v.cargo]) cargoTake(sim, id, q.item, q.count - spillItems(sim, region, at.x, at.y, q.item, q.count));
  }
  return cargoCount(v);
}

/** Hauls for the shortfall of the load, from the region's storage into the docked hold (the ordinary cargo hauls). */
function planLoad(sim: Sim, id: number, region: number, f: Ferry): void {
  if (sim.tick % PLAN_INTERVAL !== 0) return;
  const stand = cargoTile(sim, id);
  if (!stand) return;
  const res = reservations(sim);
  for (const l of f.items) {
    let need = l.count - cargoOf(sim, id, l.item) - (res.incoming.get(refKey('vehicle', id, l.item)) ?? 0);
    for (let guard = 0; need > 0 && guard < 20; guard++) {
      const s = nearestSource(sim, region, l.item, stand, res);
      if (!s) break;
      const n = Math.min(need, s.avail, DEFAULT_CARRY_CAPACITY);
      makeHaul(sim, res, 'hauling', region, s, { kind: 'vehicle', id }, l.item, n);
      need -= n;
    }
  }
}

/** True while a haul job still moves goods into or out of the vehicle (crew carrying them). */
function hauling(sim: Sim, vehicle: number): boolean {
  return sim.world.query(JobC).some((j) => {
    const h = sim.world.get(j, JobC)?.haul;
    return !!h && ((h.src.kind === 'vehicle' && h.src.id === vehicle) || (h.dst.kind === 'vehicle' && h.dst.id === vehicle));
  });
}

const loaded = (sim: Sim, id: number, f: Ferry): boolean => f.items.every((l) => cargoOf(sim, id, l.item) >= l.count);

/** Get the crew aboard: walk to the docked shuttle and climb in, or (hovering) float to it in a suit. Drops anyone who cannot. */
function loadCrew(sim: Sim, id: number, v: Vehicle, f: Ferry, mode: 'dock' | 'hover'): void {
  f.crew = f.crew.filter((c) => sim.world.has(c, CrewC) && (sim.world.has(c, AboardC) || sim.world.has(c, PositionC)));
  if (!due(f)) return;
  for (const c of f.crew) {
    if (sim.world.get(c, AboardC)?.vehicle === id || sim.world.has(c, EmbarkOrderC) || sim.world.has(c, EvaFloatC)) continue;
    if (mode === 'dock') sim.enqueue({ type: 'vehicle.embark', crew: c, vehicle: id });
    else if (sim.world.has(c, SuitC)) {
      if (!sim.world.has(c, DraftedC)) sim.world.add(c, DraftedC, { target: null });
      sim.enqueue({ type: 'eva.board', crew: c, vehicle: id });
    } else f.crew = f.crew.filter((x) => x !== c); // no suit and no airlock: cannot come
  }
}

function aboardNow(sim: Sim, id: number, f: Ferry): number[] {
  return f.crew.filter((c) => sim.world.get(c, AboardC)?.vehicle === id);
}

function gather(sim: Sim, id: number, v: Vehicle, f: Ferry): void {
  if (!arrive(sim, id, v, f, f.from)) return;
  const mode = v.state === 'docked' ? 'dock' : 'hover';
  v.outbound = f.items.length > 0;
  loadCrew(sim, id, v, f, mode);
  if (f.items.length > 0 && !loaded(sim, id, f)) {
    if (mode === 'hover' ? f.timer >= sec(sim.content.trade?.exchangeSec ?? 3) : f.timer > sec(HAUL_SEC)) takeInstant(sim, id, f.from, f);
    else if (mode === 'dock') planLoad(sim, id, f.from, f);
  }
  const crewReady = aboardNow(sim, id, f).length === f.crew.length;
  const timedOut = f.timer > sec(CREW_SEC) + sec(HAUL_SEC);
  if (!(loaded(sim, id, f) || timedOut) || !(crewReady || timedOut)) return;
  f.crew = aboardNow(sim, id, f);
  f.items = f.items.map((l) => ({ item: l.item, count: Math.min(l.count, cargoOf(sim, id, l.item)) })).filter((l) => l.count > 0);
  for (const c of occupants(v)) if (!f.crew.includes(c) && sim.world.has(c, EmbarkOrderC)) sim.world.remove(c, EmbarkOrderC);
  if (f.crew.length === 0 && f.items.length === 0) return abort(f, 'nothing');
  f.loaded = f.items.map((l) => ({ ...l }));
  v.outbound = true; // sealed: cargoJobs must not take it back off at the pickup
  if (v.state === 'docked') sim.enqueue({ type: 'vehicle.undock', vehicle: id });
  go(f, 'toDest');
}

function deliver(sim: Sim, id: number, v: Vehicle, f: Ferry): void {
  const mode = v.state === 'docked' ? 'dock' : 'hover';
  const items = cargoCount(v);
  const crewAboard = aboardNow(sim, id, f);
  v.outbound = false;
  // Crew
  if (crewAboard.length > 0) {
    if (mode === 'dock') {
      const at = boardingTile(sim, id);
      const grid = at && shipGrid(sim, at.shipId);
      if (at && grid && isTileWalkable(sim, grid, at.x, at.y)) for (const c of crewAboard) unboardCrew(sim, c, id, at);
    } else if (due(f) && f.timer < sec(CREW_SEC)) for (const c of crewAboard) sim.enqueue({ type: 'eva.out', vehicle: id, crew: c });
  }
  // Landed suited crew belong to the region now: free to work, and the suit stays with them (the shuttle may leave).
  for (const c of f.crew) {
    if (sim.world.has(c, AboardC) || sim.world.has(c, EvaFloatC)) continue;
    const suit = sim.world.get(c, SuitC);
    if (suit?.vehicle === id) {
      delete suit.vehicle;
      if (sim.world.get(c, DraftedC)?.target === null) sim.world.remove(c, DraftedC);
    }
  }
  // Cargo
  let left = items;
  if (items > 0 && (mode === 'hover' ? f.timer >= sec(sim.content.trade?.exchangeSec ?? 3) : f.timer > sec(HAUL_SEC))) left = dropInstant(sim, id, f.to);
  const still = aboardNow(sim, id, f).length;
  const floating = f.crew.some((c) => sim.world.has(c, EvaFloatC));
  if ((left > 0 || hauling(sim, id)) && f.timer <= sec(HAUL_SEC) + 1) return; // crew are unloading through the unloaders (cargoJobs)
  if (floating || (still > 0 && f.timer <= sec(CREW_SEC))) return;
  sim.events.emit({ type: 'ferry.delivered', vehicle: id, to: f.to, items: items - left, crew: f.crew.length - still });
  if (left > 0) f.reason ??= 'noRoom';
  f.left = v.cargo.map((q) => ({ ...q }));
  f.crew = [];
  go(f, 'home');
}

function home(sim: Sim, id: number, v: Vehicle, f: Ferry): void {
  if (v.state === 'stowed') {
    // Anyone still aboard (a run called off, or no suit for them) gets out at the bay; the hold is unloaded by the cargo hauls.
    const at = boardingTile(sim, id);
    const grid = at && shipGrid(sim, at.shipId);
    if (at && grid && isTileWalkable(sim, grid, at.x, at.y)) for (const c of occupants(v)) unboardCrew(sim, c, id, at);
    v.autopilot = false;
    v.outbound = false;
    sim.world.remove(id, FerryC);
    settleTransfer(sim, f);
    sim.events.emit({ type: 'ferry.done', vehicle: id, ...(f.reason ? { reason: f.reason } : {}) });
    return;
  }
  if (outsideCrew(sim, id).length > 0 || sim.world.has(id, EvaFloatC)) return;
  if (f.timer > sec(FLIGHT_SEC * 2) || !v.home) {
    // Nowhere to land (bay gone): drop the run and leave the shuttle hovering.
    v.autopilot = false;
    sim.world.remove(id, FerryC);
    f.reason ??= 'lost';
    settleTransfer(sim, f);
    sim.events.emit({ type: 'ferry.done', vehicle: id, reason: 'lost' });
    return;
  }
  if (due(f) && v.dest?.type !== 'bay') sim.enqueue({ type: 'vehicle.return', vehicle: id });
}

/**
 * Base logistics (see ferry/components.ts). Each run is a small state machine: fly to the pickup region and dock (or hover),
 * load the hold with ordinary crew hauls and board the crew, fly to the drop-off region, unload (the cargo planner takes the
 * hold off a docked shuttle; a hover swaps at once), land the crew, fly home. Flight is ordinary vehicle commands issued here
 * and applied next tick. Runs after the vehicle system so it sees this tick's arrivals.
 */
export function ferrySystem(sim: Sim): void {
  for (const id of [...sim.world.query(FerryC)].sort((a, b) => a - b)) {
    const f = sim.world.get(id, FerryC) as Ferry;
    const v = sim.world.get(id, VehicleC);
    if (!v) continue;
    f.timer++;
    if (f.phase !== 'home' && (!isPickupRegion(sim, f.from) || !isFerryRegion(sim, f.to) || !shipById(sim, f.from) || !shipById(sim, f.to))) abort(f, 'lost');
    switch (f.phase) {
      case 'toFrom':
        if (arrive(sim, id, v, f, f.from)) go(f, 'gather');
        break;
      case 'gather':
        gather(sim, id, v, f);
        break;
      case 'toDest':
        if (arrive(sim, id, v, f, f.to)) go(f, 'deliver');
        break;
      case 'deliver':
        deliver(sim, id, v, f);
        break;
      case 'home':
        home(sim, id, v, f);
        break;
    }
  }
}
