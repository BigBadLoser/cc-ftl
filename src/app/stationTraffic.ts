import { AirlockC, BodyC, ModuleC, ShipC, VehicleC, airlockWorking, shipIdOf, type Sim } from '../sim';
import type { UiStationTraffic } from '../ui/api';

/** Ships farther than this many tiles from the station are not on its sensors. */
export const RANGE = 300;

/** The starmap fleet sprite family for a ship, by its side and role. */
function fleetOf(side: string, role: string | undefined): string {
  if (side === 'player') return 'player';
  if (side === 'hostile') return 'raider';
  return /min/.test(role ?? '') ? 'miner' : /patrol|navy|mil/.test(role ?? '') ? 'patrol' : 'trader';
}
/** Facing in the starmap's 45 degree steps for a vector. */
const dirOf = (dx: number, dy: number): number => ((Math.round((Math.atan2(dy, dx) * 180) / Math.PI / 45) % 8) + 8) % 8;

/** Working airlocks of the station, and how many of them no live deal holds or shuttle sits at. */
function docks(sim: Sim, station: number): { all: number; free: number } {
  const held = new Set<number>();
  for (const d of sim.trade.deals) if (d.ship === station && d.dock && d.phase !== 'done' && d.phase !== 'failed') held.add(d.dock.airlock);
  for (const id of sim.world.query(VehicleC)) { const v = sim.world.get(id, VehicleC); if (v && v.state === 'docked') held.add(v.dock); }
  let all = 0;
  let free = 0;
  for (const id of sim.world.query(AirlockC, ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || shipIdOf(sim, m) !== station || !airlockWorking(sim, id)) continue;
    all++;
    if (!held.has(id)) free++;
  }
  return { all, free };
}

/** What the app layer remembers about a station between snapshots: its log lines (newest first) and which way each ship is heading. */
export interface StationLogView {
  log: UiStationTraffic['log'];
  heading: (ship: number) => 'in' | 'out' | '';
}

/** Ships near the station (positions in tiles from it) and the player's shuttles on trade runs. Headings are filled in by the caller. */
export function contactsOf(sim: Sim, station: number): UiStationTraffic['contacts'] {
  const st = sim.world.get(station, ShipC);
  if (!st) return [];
  const cx = st.x + st.width / 2;
  const cy = st.y + st.height / 2;
  const contacts: UiStationTraffic['contacts'] = [];
  for (const id of sim.world.query(ShipC)) {
    const s = sim.world.get(id, ShipC);
    if (!s || id === station || (s.state !== 'active' && s.state !== 'disabled') || s.outpost?.hidden) continue;
    const dx = s.x + s.width / 2 - cx;
    const dy = s.y + s.height / 2 - cy;
    if (Math.hypot(dx, dy) > RANGE) continue;
    contacts.push({ id, kind: s.faction === 'player' ? 'you' : 'ship', dx, dy, label: s.faction === 'player' ? 'YOU' : s.name.toUpperCase(), fleet: fleetOf(s.faction, s.gen?.role), dir: dirOf(-dx, -dy), head: '' });
  }
  for (const d of sim.trade.deals) {
    if (d.ship !== station || d.handover) continue;
    const b = d.vehicle && d.phase !== 'done' && d.phase !== 'failed' ? sim.world.get(d.vehicle, BodyC) : undefined;
    if (!b || !sim.world.has(d.vehicle, VehicleC)) continue;
    contacts.push({ id: d.vehicle, kind: 'shuttle', dx: b.x - cx, dy: b.y - cy, label: d.trip ? `SHUTTLE · TRIP ${d.trip.n}/${d.trip.of}` : 'SHUTTLE', fleet: 'shuttle', dir: 0, head: '' });
  }
  return contacts;
}

/** What a station's sensors see: contacts, free docks and the log the app layer kept (empty without one). */
export function stationTraffic(sim: Sim, station: number, view?: StationLogView): UiStationTraffic {
  const contacts = contactsOf(sim, station).map((c) => (c.kind === 'ship' && view ? { ...c, head: view.heading(c.id) } : c));
  return { contacts, docksFree: docks(sim, station).free, log: view?.log.slice(0, 3) ?? [] };
}
