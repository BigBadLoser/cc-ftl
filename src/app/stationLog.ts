import { AirlockC, ModuleC, ShipC, TraderC, airlockWorking, shipIdOf, type Sim, type SimEvent } from '../sim';
import { TICK_HZ } from '../sim/time';
import { RANGE, type StationLogView } from './stationTraffic';

type Line = StationLogView['log'][number];
const KEEP = 16;

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

type PhaseEvent = Extract<SimEvent, { type: 'trade.phase' }>;

/** What a deal's shuttle just did, as one log line (null for phases not worth a line). */
function dealLine(sim: Sim, e: PhaseEvent): { who: string; what: string } | null {
  const sent = names(sim, e.give);
  const got = names(sim, e.get);
  const trip = e.trip ? ` (trip ${e.trip.n} of ${e.trip.of})` : '';
  switch (e.to) {
    case 'load': return { who: 'Shuttle', what: `loading${sent ? ` ${sent}` : got ? ` ${got}` : ''}${trip}` };
    case 'out': return { who: 'Shuttle', what: `launched${sent ? ` with ${sent}` : ''}${trip}` };
    case 'dockStation': return { who: 'Shuttle', what: `docking at airlock${airlockNumber(sim, e.ship, e.dock || undefined)}${trip}` };
    case 'stationWork': case 'exchange': return { who: 'Station crew', what: `swapping cargo${trip}` };
    // Straight from dispatch to back: the station's own shuttle setting out with the goods; later, the player's shuttle coming home.
    case 'back': return e.from === 'dispatch' ? { who: 'Shuttle', what: `launched${got ? ` with ${got}` : ''}${trip}` } : { who: 'Shuttle', what: `heading home${got ? ` with ${got}` : ''}${trip}` };
    case 'done': return { who: 'Shuttle', what: `delivered${got ? ` ${got}` : sent ? ` ${sent}` : ''}` };
    case 'failed': return { who: 'Order', what: `called off${e.reason ? `: ${e.reason}` : ''}` };
    default: return null; // queued, dispatch, unload
  }
}

/** The station's own ships: markets that are stations and still in play. */
const isStation = (sim: Sim, id: number): boolean => !!sim.world.get(id, TraderC)?.station && sim.world.has(id, ShipC);

/**
 * A small log per station, kept in app state from the sim's output events (no diffing): `trade.phase` for a deal's shuttle (launched, docked,
 * swapping, heading home, delivered), `ship.arrived` and `ship.departed` for ships coming and going within the station's sensor range.
 * Lines are stamped with the game clock of the tick the event happened in. It records what happens from the moment it exists; ships
 * that were already there, and the ones placed while the player drops into a node, leave no line.
 */
export class StationLog {
  private rings = new Map<number, Line[]>();

  private push(station: number, tick: number, who: string, what: string): void {
    const ring = this.rings.get(station) ?? [];
    ring.unshift({ at: clockAt(tick), who, what });
    ring.length = Math.min(ring.length, KEEP);
    this.rings.set(station, ring);
  }

  /** Feed the events the sim output since the last call (the loop's drain). */
  onEvents(sim: Sim, events: readonly SimEvent[]): void {
    for (const e of events) {
      const tick = sim.events.tickOf(e, sim.tick);
      if (e.type === 'trade.phase') {
        if (e.handover || !isStation(sim, e.ship)) continue;
        const line = dealLine(sim, e);
        if (line) this.push(e.ship, tick, line.who, line.what);
      } else if ((e.type === 'ship.arrived' || e.type === 'ship.departed') && sim.sector.state === 'active') {
        const what = e.type === 'ship.arrived' ? (e.reason === 'jump-in' ? 'jumped in' : 'arrived') : e.reason === 'wrecked' ? 'destroyed' : e.reason === 'fleet' || e.reason === 'scene' ? 'left' : 'jumped away';
        for (const id of sim.world.query(TraderC)) {
          const st = isStation(sim, id) && id !== e.ship ? sim.world.get(id, ShipC) : undefined;
          if (st && Math.hypot(e.x - (st.x + st.width / 2), e.y - (st.y + st.height / 2)) <= RANGE) this.push(id, tick, e.name, what);
        }
      }
    }
  }

  /** The newest-first log of one station. */
  view(station: number): StationLogView {
    return { log: this.rings.get(station) ?? [] };
  }
}
