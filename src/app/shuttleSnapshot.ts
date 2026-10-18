import {
  AboardC, AirlockC, CrewC, DeadC, EmbarkOrderC, ModuleC, PositionC, ShipC, VehicleBayC, airlockWorking, boardingTile,
  vehicleViews, type Sim,
} from '../sim';
import type { UiShuttleCrew, UiShuttles } from '../ui/api';

const PLAYER = 1;

function crewRef(sim: Sim, id: number): UiShuttleCrew | null {
  const c = id ? sim.world.get(id, CrewC) : undefined;
  return c ? { id, name: c.name, role: sim.content.roles[c.role]?.name ?? c.role, boarding: sim.world.get(id, EmbarkOrderC)?.vehicle ?? 0 } : null;
}

function shipName(sim: Sim, gridId: number): string {
  for (const id of sim.world.query(ShipC)) {
    const s = sim.world.get(id, ShipC);
    if (s?.gridId === gridId) return s.name;
  }
  return 'Ship';
}

/** Plain-data shuttle state for the shuttle panel: the player's shuttles, free crew, bays and dockable airlocks. Reads the sim only. */
export function buildShuttles(sim: Sim): UiShuttles {
  const airlocks: UiShuttles['airlocks'] = [];
  const claimed = new Set<number>();
  for (const v of vehicleViews(sim)) if (v.dockedAt) claimed.add(v.dockedAt);
  for (const id of sim.world.query(AirlockC, ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || m.gridId === PLAYER) continue;
    const ship = [...sim.world.query(ShipC)].map((s) => sim.world.get(s, ShipC)).find((s) => s?.gridId === m.gridId);
    if (!ship || ship.state === 'fled') continue;
    airlocks.push({ id, gridId: m.gridId, ship: ship.name, working: airlockWorking(sim, id), busy: claimed.has(id), x: m.x, y: m.y });
  }
  const shuttles: UiShuttles['shuttles'] = [];
  for (const v of vehicleViews(sim)) {
    if (v.homeGrid !== PLAYER) continue;
    const def = sim.content.vehicles?.[v.def];
    const dockM = v.dockedAt ? sim.world.get(v.dockedAt, ModuleC) : undefined;
    shuttles.push({
      id: v.id, name: def?.name ?? 'Shuttle', state: v.state, hp: Math.round(v.hp), maxHp: v.maxHp, capacity: def?.capacity ?? 0,
      pilot: crewRef(sim, v.pilot), passengers: v.passengers.map((c) => crewRef(sim, c)).filter((c): c is UiShuttleCrew => !!c),
      destination: v.destination, dockShip: dockM ? shipName(sim, dockM.gridId) : null, bay: v.bay,
      boardable: boardingTile(sim, v.id) !== null,
    });
  }
  const roster: UiShuttleCrew[] = [];
  for (const id of sim.world.query(CrewC)) {
    if (sim.world.has(id, DeadC) || sim.world.has(id, AboardC)) continue;
    const pos = sim.world.get(id, PositionC);
    if (pos?.gridId !== PLAYER) continue;
    const ref = crewRef(sim, id);
    if (ref) roster.push(ref);
  }
  const bays: UiShuttles['bays'] = [];
  for (const id of sim.world.query(VehicleBayC, ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (m?.gridId === PLAYER) bays.push({ id, empty: !sim.world.get(id, VehicleBayC)?.vehicle });
  }
  return { shuttles, airlocks, roster, bays };
}
