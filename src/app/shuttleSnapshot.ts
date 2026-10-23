import { FerryC, TransferC, regionStock, ferryFree, ferryRegions, pickFerryShuttle, AboardC, AirlockC, CrewC, DeadC, EmbarkOrderC, ModuleC, VehicleC, PositionC, ShipC, VehicleBayC, airlockWorking, boardingTile, Struct, TraderC, vehicleSuits, vehicleViews, type Sim } from '../sim';
import { localOf } from './moduleSnapshot';
import type { UiDerelict, UiShuttle, UiShuttleCrew, UiShuttles, UiTransfer } from '../ui/api';
import { shipIdOf, shipGrid } from '../sim/regions';
import type { Ship } from '../sim/combat/components';
import { homeShip } from '../sim/index';


/** The live trade deal this shuttle is flying, as a status line. */
function tradeRun(sim: Sim, vehicle: number): UiShuttle['trade'] {
  const d = sim.trade.deals.find((x) => x.vehicle === vehicle && x.phase !== 'done' && x.phase !== 'failed');
  if (!d) return null;
  const status: Record<string, string> = {
    dispatch: 'Heading to the airlock to load', load: 'Crew loading the cargo', out: 'Flying the cargo over', exchange: 'Swapping cargo',
    back: 'Bringing the goods home', unload: 'Crew unloading the cargo',
  };
  return { status: status[d.phase] ?? d.phase, partner: sim.world.get(d.ship, TraderC)?.name ?? 'Trader' };
}

const FERRY_STATUS: Record<string, string> = {
  toFrom: 'Flying to the pickup', gather: 'Loading and boarding', toDest: 'Flying to the drop-off', deliver: 'Unloading and landing', home: 'Heading home',
};

/** The base run this shuttle is on, as a status line. */
function ferryRun(sim: Sim, vehicle: number): UiShuttle['ferry'] {
  const f = sim.world.get(vehicle, FerryC);
  return f ? { status: FERRY_STATUS[f.phase] ?? f.phase, to: shipName(sim, f.to) } : null;
}

const BLOCK_TEXT: Record<string, string> = {
  noShuttle: 'Waiting for a free shuttle', noPilot: 'Waiting for a free pilot', noAirlock: 'No working airlock to dock at',
  noStock: 'Nothing left to take at the pickup', failed: 'Trips keep failing: cancel and retry',
};

/** The queued, boarding and running transfer orders as plain data, oldest first. */
function transferList(sim: Sim): UiTransfer[] {
  const out: UiTransfer[] = [];
  for (const id of [...sim.world.query(TransferC)].sort((a, b) => a - b)) {
    const t = sim.world.get(id, TransferC);
    if (!t) continue;
    const pilot = t.pilot ? sim.world.get(t.pilot, CrewC)?.name : undefined;
    const phase = FERRY_STATUS[sim.world.get(t.vehicle, FerryC)?.phase ?? ''];
    const status =
      t.status === 'blocked' ? BLOCK_TEXT[t.reason ?? ''] ?? 'Blocked'
        : t.status === 'boarding' ? `${pilot ?? 'The pilot'} is heading to the shuttle`
          : t.status === 'underway' ? `Trip ${t.trips + 1}: ${(phase ?? 'on its way').toLowerCase()}${pilot ? ` (${pilot})` : ''}`
            : 'Waiting for a shuttle';
    out.push({
      id, from: shipName(sim, t.from), to: shipName(sim, t.to), state: t.status, status, auto: !!t.auto, total: t.total, moved: t.moved, trips: t.trips,
      items: t.items.map((l) => ({ item: l.item, name: sim.content.items[l.item]?.name ?? l.item, count: l.count })),
    });
  }
  return out;
}

/** The player's regions with the stock in their storage (only when there is more than one: the home ship alone has nowhere to run). */
function regionList(sim: Sim, home: number): UiShuttles['regions'] {
  const ids = ferryRegions(sim);
  if (ids.length < 2) return [];
  return ids.sort((a, b) => (a === home ? -1 : b === home ? 1 : a - b)).map((id) => {
    const stock = regionStock(sim, id).map(({ item, count }) => ({ item, name: sim.content.items[item]?.name ?? item, count }));
    return { id, name: shipName(sim, id), home: id === home, stock };
  });
}

function crewRef(sim: Sim, id: number): UiShuttleCrew | null {
  const c = id ? sim.world.get(id, CrewC) : undefined;
  return c ? { id, name: c.name, role: sim.content.roles[c.role]?.name ?? c.role, boarding: sim.world.get(id, EmbarkOrderC)?.vehicle ?? 0 } : null;
}

function shipName(sim: Sim, shipId: number): string {
  return sim.world.get(shipId, ShipC)?.name ?? 'Ship';
}

/** Plain-data shuttle state for the shuttle panel: the player's shuttles, free crew, bays and dockable airlocks. Reads the sim only. */
export function buildShuttles(sim: Sim): UiShuttles {
  const PLAYER = homeShip(sim);
  const airlocks: UiShuttles['airlocks'] = [];
  const claimed = new Set<number>();
  for (const v of vehicleViews(sim)) if (v.dockedAt) claimed.add(v.dockedAt);
  for (const id of sim.world.query(AirlockC, ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || shipIdOf(sim, m) === PLAYER) continue;
    const shipId = shipIdOf(sim, m);
    const ship = sim.world.get(shipId, ShipC);
    if (!ship || ship.state === 'fled' || (ship.outpost?.dock && ship.outpost.dock !== id)) continue; // an outpost's other airlocks open onto ground
    airlocks.push({ id, shipId, ship: ship.name, working: airlockWorking(sim, id), busy: claimed.has(id), ...localOf(sim, shipIdOf(sim, m), m.x, m.y) });
  }
  const shuttles: UiShuttles['shuttles'] = [];
  for (const v of vehicleViews(sim)) {
    const def = sim.content.vehicles?.[v.def];
    if (v.homeGrid !== PLAYER || def?.class === 'pod') continue; // mining pods fly their own orders: not in the shuttle panel
    const dockM = v.dockedAt ? sim.world.get(v.dockedAt, ModuleC) : undefined;
    shuttles.push({
      id: v.id, name: def?.name ?? 'Shuttle', state: v.state, hp: Math.round(v.hp), maxHp: v.maxHp, capacity: def?.capacity ?? 0, cargo: def?.cargo ?? 0,
      pilot: crewRef(sim, v.pilot), passengers: v.passengers.map((c) => crewRef(sim, c)).filter((c): c is UiShuttleCrew => !!c),
      destination: v.destination, dockShip: dockM ? shipName(sim, shipIdOf(sim, dockM)) : null, bay: v.bay,
      boardable: boardingTile(sim, v.id) !== null,
      trade: tradeRun(sim, v.id),
      ferry: ferryRun(sim, v.id),
      ferryFree: ferryFree(sim, v.id),
      hoverShip: v.hoveringGrid ? shipName(sim, v.hoveringGrid) : null,
      suits: vehicleSuits(sim, sim.world.get(v.id, VehicleC) as never),
      canEva: v.state === 'flying' && !v.destination && v.hovering !== 0 && v.passengers.length > 0 && vehicleSuits(sim, sim.world.get(v.id, VehicleC) as never) > 0,
    });
  }
  const roster: UiShuttleCrew[] = [];
  for (const id of sim.world.query(CrewC)) {
    if (sim.world.has(id, DeadC) || sim.world.has(id, AboardC)) continue;
    const pos = sim.world.get(id, PositionC);
    if (shipIdOf(sim, pos) !== PLAYER) continue;
    const ref = crewRef(sim, id);
    if (ref) roster.push(ref);
  }
  const bays: UiShuttles['bays'] = [];
  for (const id of sim.world.query(VehicleBayC, ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (shipIdOf(sim, m) === PLAYER) bays.push({ id, empty: !sim.world.get(id, VehicleBayC)?.vehicle });
  }
  const targets: UiShuttles['targets'] = [];
  for (const id of sim.world.query(ShipC)) {
    const s = sim.world.get(id, ShipC);
    if (s && id !== PLAYER && s.state !== 'fled' && !s.outpost?.hidden) targets.push({ ship: id, name: s.name, ...(s.state === 'wreck' ? { derelict: derelictInfo(sim, id, s) } : {}) });
  }
  return { shuttles, airlocks, targets, roster, bays, regions: regionList(sim, PLAYER), transfers: transferList(sim), ferryReady: pickFerryShuttle(sim) !== 0 };
}

/** Hull, air, power and jammed doors of a wreck, read from its grid and modules. */
function derelictInfo(sim: Sim, id: number, s: Ship): UiDerelict {
  const grid = shipGrid(sim, id);
  let o2 = 0, n = 0, jammed = 0;
  if (grid) {
    for (let y = grid.y0; y < grid.y0 + grid.height; y++)
      for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
        const k = grid.get('struct', x, y);
        if (k === Struct.Floor) { o2 += grid.get('o2', x, y); n++; }
        else if (k === Struct.Door && grid.get('jam', x, y) !== 0) jammed++;
      }
  }
  const mean = n ? o2 / n : 0;
  let source = false;
  for (const m of sim.world.query(ModuleC)) {
    const c = sim.world.get(m, ModuleC);
    if (c && shipIdOf(sim, c) === id && c.powered && c.enabled && c.hp > 0 && (sim.content.modules[c.def]?.power ?? 0) > 0) source = true;
  }
  return {
    kind: (s.gen?.faction ?? '').replace(/^faction\./, ''),
    // A ship wrecked in play (combat or scuttling) has no ruin data: it is a fresh combat wreck.
    cause: s.ruin?.cause ?? 'combat',
    hull: s.integrity,
    air: mean < 5 ? 'vacuum' : mean < 14 ? 'thin' : 'breathable',
    power: source ? 'emergency' : 'off',
    jammed,
  };
}
