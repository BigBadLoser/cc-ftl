import { TraderC, type Sim, type SimEvent } from '../sim';
import type { UiLogEntry } from '../ui/api';
import { createDescriber, type LogEntry } from './logText';
import { shipSubject } from './subjects';
import { createStore, type Readable } from './store';

const MAX = 200;

export interface EventLog {
  list: Readable<UiLogEntry[]>;
  /** Log every notable event of a tick, then any credits that came in. */
  onEvents(events: SimEvent[]): void;
  /** Credits that came in without an event (anything that just sets the balance) still get their entry. */
  sync(): void;
}

/**
 * The ship's log: the full record of what happened, newest first (UI-side only; never feeds the sim).
 * Events that also raise an alert are logged too. A rise in the credit balance, from whatever cause (job payout, trade, bounty),
 * adds a `+N ₵` entry that the UI highlights for a moment; it keys off the balance, not off event names.
 */
export function createEventLog(sim: Sim): EventLog {
  const store = createStore<UiLogEntry[]>([]);
  const describe = createDescriber(sim);
  let nextId = 1;
  let credits = sim.trade.credits;

  function add(list: UiLogEntry[], d: LogEntry & { amount?: number }, tick: number): UiLogEntry[] {
    const top = list[0];
    const born = Date.now();
    // The same thing again straight away folds into one line with a count.
    return top && top.kind === d.kind && top.text === d.text && !d.amount
      ? [{ ...top, tick, count: top.count + 1, born }, ...list.slice(1)]
      : [{ id: nextId++, tick, count: 1, born, ...d }, ...list].slice(0, MAX);
  }

  /** Where the money came from, as far as this tick's events say: the payout entry's text. */
  function source(events: SimEvent[]): Pick<LogEntry, 'text' | 'subject'> {
    const faction = (id: string) => sim.content.galaxy?.factions[id]?.name ?? id;
    for (const e of events) {
      if (e.type === 'job.handedIn') return { text: `${e.kind === 'bounty' ? 'Bounty' : 'Survey'} handed in to ${faction(e.issuer)}` };
      if (e.type === 'job.handedOver') return { text: e.via === 'own' ? 'Crate dropped at the station' : e.via === 'shuttle' ? `Crate taken by the ${faction(e.issuer)} shuttle` : 'Crate handed across' };
      if (e.type !== 'trade.settled' || e.credits >= 0) continue;
      const name = sim.world.get(e.ship, TraderC)?.name ?? 'trader';
      const s = shipSubject(sim, e.ship);
      return { text: `Paid by ${name}`, ...(s ? { subject: s } : {}) };
    }
    return { text: 'Credits received' };
  }

  function gain(list: UiLogEntry[], events: SimEvent[]): UiLogEntry[] {
    const now = sim.trade.credits;
    const delta = now - credits;
    credits = now;
    if (delta <= 0) return list;
    const src = source(events);
    return add(list, { kind: 'payout', tone: 'good', amount: delta, ...src }, sim.tick);
  }

  return {
    list: store,
    onEvents(events) {
      let list = store.get();
      for (const e of events) {
        const d = describe(e);
        if (d) list = add(list, d, sim.tick);
      }
      list = gain(list, events);
      if (list !== store.get()) store.set(list);
    },
    sync() {
      const list = gain(store.get(), []);
      if (list !== store.get()) store.set(list);
    },
  };
}
