import { shipIdOf } from '../sim/regions';
import { CrewC, PositionC, ShipC, TraderC, type Sim, type SimEvent } from '../sim';
import type { UiLogEntry } from '../ui/api';
import { createStore, type Readable } from './store';

const MAX = 40;

export interface EventLog {
  list: Readable<UiLogEntry[]>;
  /** `covers` says whether an alert shows the event right now; those wait until the alert clears (see `addCleared`). */
  onEvents(events: SimEvent[], covers?: (e: SimEvent) => boolean): void;
  /** An alert now shows this event: hold its log entry (built now, so it keeps its own text and tone) until the alert clears. */
  defer(e: SimEvent, alertId: number): void;
  /** An alert left the screen. Its held entry goes into the log, unless a newer alert for the same thing replaced it. */
  release(alertId: number, replaced: boolean): void;
}

type Entry = Pick<UiLogEntry, 'kind' | 'tone' | 'text'>;

/**
 * A short history of happenings in plain words, newest first (UI-side only; never feeds the sim).
 * Ongoing states (low oxygen, power shortage, missing materials) stay with the alerts; only things that happened land here.
 */
export function createEventLog(sim: Sim): EventLog {
  const store = createStore<UiLogEntry[]>([]);
  const held = new Map<number, { d: Entry; tick: number }>();
  let nextId = 1;

  const home = () => 1;
  const crewName = (id: number) => sim.world.get(id, CrewC)?.name ?? 'Crew';
  const ours = (crew: number) => shipIdOf(sim, sim.world.get(crew, PositionC)) === home();
  const ship = (id: number) => sim.world.get(id, ShipC);
  const mine = (id: number) => ship(id)?.faction === 'player';
  const shipName = (id: number) => ship(id)?.name ?? 'Ship';
  const trader = (id: number) => sim.world.get(id, TraderC)?.name ?? 'trader';

  function describe(e: SimEvent): Entry | null {
    switch (e.type) {
      case 'fire.started': return e.ship === home() ? { kind: 'fire', tone: 'bad', text: 'Fire broke out' } : null;
      case 'hull.breach': return e.ship === home() ? { kind: 'breach', tone: 'bad', text: 'Hull breached' } : null;
      case 'crew.downed': return ours(e.crew) ? { kind: e.type, tone: 'bad', text: `${crewName(e.crew)} went down` } : null;
      case 'crew.died': return ours(e.crew) ? { kind: e.type, tone: 'bad', text: `${crewName(e.crew)} died` } : null;
      case 'crew.rescued': return ours(e.crew) ? { kind: e.type, tone: 'good', text: `${crewName(e.crew)} was rescued` } : null;
      case 'module.destroyed': {
        const name = sim.content.modules[e.def]?.name ?? 'Module';
        return mine(e.ship) ? { kind: e.type, tone: 'bad', text: `${name} destroyed` } : { kind: e.type, tone: 'good', text: `Enemy ${name} destroyed` };
      }
      case 'combat.started': return { kind: 'combat', tone: 'warn', text: 'Hostile ship in range' };
      case 'combat.ended': return { kind: 'combat', tone: 'info', text: 'Combat over' };
      case 'ship.disabled': return { kind: e.type, tone: mine(e.ship) ? 'bad' : 'good', text: `${shipName(e.ship)} disabled` };
      case 'ship.destroyed': return mine(e.ship) ? { kind: 'lost', tone: 'bad', text: 'Your ship was destroyed' } : { kind: e.type, tone: 'good', text: `${shipName(e.ship)} destroyed` };
      case 'ship.fled': return { kind: e.type, tone: 'info', text: `${shipName(e.ship)} jumped away` };
      case 'station.alarm': return { kind: 'combat', tone: 'bad', text: `Alarm on ${shipName(e.ship)}: ${e.reason}` };
      case 'station.calm': return { kind: 'combat', tone: 'info', text: `${shipName(e.ship)} stands down its alarm` };
      case 'ship.provoked': return { kind: 'combat', tone: 'bad', text: `${shipName(e.ship)} is roused: its guns turn on you` };
      case 'ship.captured': return { kind: e.type, tone: e.by === 'player' ? 'good' : 'bad', text: e.by === 'player' ? `${shipName(e.ship)} captured` : `${shipName(e.ship)} was captured` };
      case 'container.detached': return { kind: 'container', tone: 'info', text: 'A cargo container broke loose' };
      case 'production.done': return { kind: 'production', tone: 'good', text: `${sim.content.recipes[e.recipe]?.name ?? 'Batch'} finished` };
      case 'trade.hailAnswered': return { kind: 'hail', tone: 'info', text: `${e.name} answered the hail` };
      case 'trade.hailRefused': return { kind: 'hail', tone: 'warn', text: `${e.name} refused to talk` };
      case 'trade.dealMade': return { kind: 'trade', tone: 'good', text: `Deal made with ${trader(e.ship)}` };
      case 'trade.delivered': return { kind: 'trade', tone: 'good', text: e.to === 'player' ? `Cargo from ${trader(e.ship)} arrived` : `Cargo delivered to ${trader(e.ship)}` };
      case 'trade.settled': return { kind: 'trade', tone: 'good', text: `Trade with ${trader(e.ship)} completed` };
      case 'trade.failed': return { kind: 'trade', tone: 'warn', text: `Deal with ${trader(e.ship)} called off` };
      case 'story.started': {
        const def = sim.content.events?.[e.event];
        return def ? { kind: 'story', tone: 'info', text: def.title } : null;
      }
      case 'story.effect': return e.text ? { kind: 'story', tone: 'info', text: e.text } : null;
      case 'game.lost': return { kind: 'lost', tone: 'bad', text: 'Game over' };
      default: return null;
    }
  }

  function add(list: UiLogEntry[], d: Entry, tick: number): UiLogEntry[] {
    const top = list[0];
    // The same thing again straight away folds into one line with a count.
    return top && top.kind === d.kind && top.text === d.text
      ? [{ ...top, tick, count: top.count + 1 }, ...list.slice(1)]
      : [{ id: nextId++, tick, count: 1, ...d }, ...list].slice(0, MAX);
  }

  return {
    list: store,
    onEvents(events, covers) {
      let list = store.get();
      for (const e of events) {
        if (covers?.(e)) continue;
        const d = describe(e);
        if (d) list = add(list, d, sim.tick);
      }
      if (list !== store.get()) store.set(list);
    },
    defer(e, alertId) {
      const d = describe(e);
      if (d) held.set(alertId, { d, tick: sim.tick });
    },
    release(alertId, replaced) {
      const h = held.get(alertId);
      held.delete(alertId);
      if (h && !replaced) store.set(add(store.get(), h.d, h.tick));
    },
  };
}
