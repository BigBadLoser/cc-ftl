import { AirlockC, BodyC, ModuleC, ShipC, VehicleC, airlockWorking, shipIdOf, type Deal, type Sim } from '../sim';
import type { UiStationTraffic } from '../ui/api';

/** Ships farther than this many tiles from the station are not on its sensors. */
const RANGE = 300;

const names = (sim: Sim, lines: readonly { item: string; count: number }[]): string =>
  lines.map((l) => `${l.count} ${(sim.content.items[l.item]?.name ?? l.item).toLowerCase()}`).join(', ');

/** One line of the traffic log for a deal: what its shuttle is doing now (or did last). */
function logLine(sim: Sim, d: Deal): { who: string; what: string } {
  const goods = names(sim, d.get.length ? d.get : d.give);
  const trip = d.trip ? ` (trip ${d.trip.n} of ${d.trip.of})` : '';
  if (d.phase === 'queued') return { who: 'Order', what: `waits its turn${goods ? `: ${goods}` : ''}` };
  if (d.phase === 'done') return { who: 'Shuttle', what: `delivered${goods ? ` ${goods}` : ''}` };
  if (d.phase === 'failed') return { who: 'Order', what: `called off${d.reason ? `: ${d.reason}` : ''}` };
  if (d.phase === 'dispatch' || d.phase === 'load') return { who: 'Shuttle', what: `loading${goods ? ` ${goods}` : ''}${trip}` };
  if (d.phase === 'out') return { who: 'Shuttle', what: `on its way over${trip}` };
  if (d.phase === 'dockStation') return { who: 'Shuttle', what: `docking at airlock${trip}` };
  if (d.phase === 'stationWork') return { who: 'Station crew', what: `swapping cargo${trip}` };
  if (d.phase === 'exchange') return { who: 'Shuttle', what: `swapping cargo${trip}` };
  return { who: 'Shuttle', what: `bringing it home${goods ? `: ${goods}` : ''}${trip}` };
}

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

/** What a station's sensors see: ships near it (positions in tiles from the station), the player's shuttles on trade runs, and a short log of the deals. */
export function stationTraffic(sim: Sim, station: number): UiStationTraffic {
  const st = sim.world.get(station, ShipC);
  if (!st) return { contacts: [], docksFree: 0, log: [] };
  const cx = st.x + st.width / 2;
  const cy = st.y + st.height / 2;
  const contacts: UiStationTraffic['contacts'] = [];
  for (const id of sim.world.query(ShipC)) {
    const s = sim.world.get(id, ShipC);
    if (!s || id === station || (s.state !== 'active' && s.state !== 'disabled') || s.outpost?.hidden) continue;
    const dx = s.x + s.width / 2 - cx;
    const dy = s.y + s.height / 2 - cy;
    if (Math.hypot(dx, dy) > RANGE) continue;
    contacts.push({ id, kind: s.faction === 'player' ? 'you' : 'ship', dx, dy, label: s.faction === 'player' ? 'YOU' : s.name.toUpperCase(), fleet: fleetOf(s.faction, s.gen?.role), dir: dirOf(-dx, -dy) });
  }
  const mine = sim.trade.deals.filter((d) => d.ship === station && !d.handover);
  for (const d of mine) {
    const b = d.vehicle && d.phase !== 'done' && d.phase !== 'failed' ? sim.world.get(d.vehicle, BodyC) : undefined;
    if (!b || !sim.world.has(d.vehicle, VehicleC)) continue;
    contacts.push({ id: d.vehicle, kind: 'shuttle', dx: b.x - cx, dy: b.y - cy, label: d.trip ? `SHUTTLE · TRIP ${d.trip.n}/${d.trip.of}` : 'SHUTTLE', fleet: 'shuttle', dir: 0 });
  }
  const log = mine.filter((d) => d.phase !== 'queued').slice(-6).reverse().slice(0, 3).map((d) => logLine(sim, d));
  return { contacts, docksFree: docks(sim, station).free, log };
}
