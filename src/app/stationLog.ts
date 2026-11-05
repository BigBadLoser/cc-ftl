import { AirlockC, ModuleC, ShipC, TraderC, airlockWorking, shipIdOf, type Deal, type Sim } from '../sim';
import { TICK_HZ } from '../sim/time';
import { contactsOf, type StationLogView } from './stationTraffic';

type Line = StationLogView['log'][number];
const KEEP = 16;
/** A ship has to change its distance by this many tiles between two looks before it counts as moving in or out. */
const MOVING = 0.3;

/** The game clock as the top bar shows it, padded (mm:ss, h:mm:ss from an hour). */
export function clockAt(tick: number): string {
  const t = Math.floor(tick / TICK_HZ);
  const p = (n: number) => String(n).padStart(2, '0');
  return t >= 3600 ? `${Math.floor(t / 3600)}:${p(Math.floor(t / 60) % 60)}:${p(t % 60)}` : `${p(Math.floor(t / 60))}:${p(t % 60)}`;
}

const names = (sim: Sim, lines: readonly { item: string; count: number }[]): string =>
  lines.map((l) => `${l.count} ${(sim.content.items[l.item]?.name ?? l.item).toLowerCase()}`).join(', ');

/** The station's working airlocks in a stable order, so a dock can be called "airlock 2". */
function airlockNumber(sim: Sim, station: number, airlock: number | undefined): string {
  if (airlock === undefined) return '';
  const ids = sim.world.query(AirlockC, ModuleC).filter((id) => {
    const m = sim.world.get(id, ModuleC);
    return m && shipIdOf(sim, m) === station && (id === airlock || airlockWorking(sim, id));
  }).sort((a, b) => a - b);
  const i = ids.indexOf(airlock);
  return i < 0 ? '' : ` ${i + 1}`;
}

/** What a deal's shuttle just started doing, as one log line (null for phases not worth a line). */
function dealEvent(sim: Sim, station: number, d: Deal): { who: string; what: string } | null {
  const sent = names(sim, d.give);
  const got = names(sim, d.get);
  const trip = d.trip && d.trip.of > 1 ? ` (trip ${d.trip.n} of ${d.trip.of})` : '';
  switch (d.phase) {
    case 'dispatch': case 'load': return { who: 'Shuttle', what: `loading${sent ? ` ${sent}` : got ? ` ${got}` : ''}${trip}` };
    case 'out': return { who: 'Shuttle', what: `launched${sent ? ` with ${sent}` : ''}${trip}` };
    case 'dockStation': return { who: 'Shuttle', what: `docking at airlock${airlockNumber(sim, station, d.dock?.airlock)}${trip}` };
    case 'stationWork': case 'exchange': return { who: 'Station crew', what: `swapping cargo${trip}` };
    case 'done': return { who: 'Shuttle', what: `delivered${got ? ` ${got}` : sent ? ` ${sent}` : ''}` };
    case 'failed': return { who: 'Order', what: `called off${d.reason ? `: ${d.reason}` : ''}` };
    case 'queued': return null;
    default: return { who: 'Shuttle', what: `heading home${got ? ` with ${got}` : ''}${trip}` };
  }
}

/**
 * A small log per station, kept in app state by diffing the sim between snapshots (no sim change): a deal's phase moving on (shuttle
 * launched, docked, swapping, heading home, delivered), ships coming into and leaving sensor range, and ships turning inbound or outbound.
 * Lines are stamped with the game clock. Call `observe` before building a snapshot.
 */
export class StationLog {
  private rings = new Map<number, Line[]>();
  private phases = new Map<number, string>();
  private ships = new Map<number, Map<number, { dist: number; head: 'in' | 'out' | ''; name: string }>>();
  private primed = false;
  private lastTick = 0;

  private push(station: number, tick: number, who: string, what: string): void {
    const ring = this.rings.get(station) ?? [];
    ring.unshift({ at: clockAt(tick), who, what });
    ring.length = Math.min(ring.length, KEEP);
    this.rings.set(station, ring);
  }

  observe(sim: Sim): void {
    if (sim.tick < this.lastTick) { this.rings.clear(); this.phases.clear(); this.ships.clear(); this.primed = false; }
    this.lastTick = sim.tick;
    const stations = sim.world.query(TraderC).filter((id) => sim.world.get(id, TraderC)?.station && sim.world.has(id, ShipC));
    const live = new Set<number>();
    for (const d of sim.trade.deals) {
      if (d.handover || !stations.includes(d.ship)) continue;
      live.add(d.id);
      if (this.phases.get(d.id) === d.phase) continue;
      this.phases.set(d.id, d.phase);
      const e = this.primed ? dealEvent(sim, d.ship, d) : null;
      if (e) this.push(d.ship, sim.tick, e.who, e.what);
    }
    for (const id of [...this.phases.keys()]) if (!live.has(id)) this.phases.delete(id);
    for (const station of stations) {
      const fresh = !this.ships.has(station); // the first look at a station only records who is already in range
      const seen = this.ships.get(station) ?? new Map();
      const now = new Set<number>();
      for (const c of contactsOf(sim, station)) {
        if (c.kind !== 'ship') continue;
        now.add(c.id);
        const dist = Math.hypot(c.dx, c.dy);
        const name = c.label.charAt(0) + c.label.slice(1).toLowerCase();
        const prev = seen.get(c.id);
        if (!prev) {
          if (!fresh) this.push(station, sim.tick, name, 'entered sensor range');
          seen.set(c.id, { dist, head: '', name });
          continue;
        }
        const delta = dist - prev.dist;
        if (Math.abs(delta) < MOVING) continue;
        const head = delta < 0 ? 'in' : 'out';
        if (head !== prev.head && !fresh) this.push(station, sim.tick, name, head === 'in' ? 'on approach' : 'heading out');
        seen.set(c.id, { dist, head, name });
      }
      for (const [id, v] of seen) if (!now.has(id)) { if (this.primed) this.push(station, sim.tick, v.name, 'left sensor range'); seen.delete(id); }
      this.ships.set(station, seen);
    }
    this.primed = true;
  }

  /** The newest-first log and the ship headings of one station. */
  view(station: number): StationLogView {
    const ships = this.ships.get(station);
    return { log: this.rings.get(station) ?? [], heading: (ship) => ships?.get(ship)?.head ?? '' };
  }
}
