import { homeShip } from '../sim/index';
import { shipIdOf, shipGrid } from '../sim/regions';
import { CrewC, DownedC, ModuleC, NeedsC, PositionC, AllegianceC, ShipC, incomingFleets, isSuited, roomTiles, type Sim, type SimEvent } from '../sim';
import { Struct } from '../sim/structure';
import { O2_ALERT_CLEAR_ABOVE } from '../sim/tuning';
import type { UiAlert, UiAlertKind, UiSubject } from '../ui/api';
import { crewSubject, enemyShip, roomOf, tileAt } from './subjects';
import { createStore, type Readable } from './store';

const MAX = 6;
const EXPIRE_MS = 45000;

/**
 * Which events raise an alert. Alerts are for urgent, actionable things only; everything else is log-only (the ship's log records
 * every notable event, urgent or not, see eventLog.ts). Events missing from this table are log-only. Each urgent alert needs a
 * jump target (`subject`) and a way to clear itself once the condition is resolved (`resolved`, polled by `sync`).
 */
export const ALERT_URGENCY: Partial<Record<SimEvent['type'], 'urgent' | 'log'>> = {
  'combat.started': 'urgent', 'fire.started': 'urgent', 'hull.breach': 'urgent', 'o2.low': 'urgent', 'power.shortage': 'urgent',
  'crew.downed': 'urgent', 'suit.airLow': 'urgent', 'suit.airOut': 'urgent', 'crew.starving': 'urgent', 'eggsac.hatched': 'urgent',
  'story.started': 'urgent', // only a notice with a lead you can open; plain notices are log-only (see describe)
  'crew.died': 'log', 'crew.rescued': 'log', 'crew.moodLow': 'log', 'job.missingMaterials': 'log', 'storage.full': 'log', 'production.done': 'log',
  'mining.waiting': 'log', 'mining.done': 'log', 'transfer.queued': 'log', 'transfer.delivered': 'log', 'transfer.blocked': 'log',
  'outpost.discovered': 'log', 'ship.provoked': 'log', 'module.destroyed': 'log', 'ship.destroyed': 'log', 'ship.fled': 'log', 'station.alarm': 'log',
  'trade.hailAnswered': 'log', 'trade.hailRefused': 'log', 'trade.dealMade': 'log', 'crew.hired': 'log', 'trade.delivered': 'log',
  'trade.settled': 'log', 'trade.failed': 'log', 'galaxy.encounter': 'log', 'galaxy.evadeRoll': 'log', 'scan.settled': 'log',
  'truce.breached': 'log', 'galaxy.bribed': 'log', 'galaxy.eventEntered': 'log',
};
const urgent = (type: SimEvent['type']) => ALERT_URGENCY[type] === 'urgent';

export interface Alerts {
  list: Readable<UiAlert[]>;
  onEvents(events: SimEvent[]): void;
  dismiss(id: number): void;
  get(id: number): UiAlert | undefined;
  /** Arrival warnings: bring the "drops from hyperspace" alerts in line with the fleets now on their way to the player's node (state, not events). */
  syncIncoming(): void;
  /** Clear every alert whose condition has resolved (combat over, fire out, crew member stabilised...). Cheap; call it every few frames. */
  sync(): void;
}

interface Raised { kind: UiAlertKind; key: string; text: string; subject: UiSubject | null; resolved?: () => boolean; notice?: UiAlert['notice'] }

/** Turns urgent sim events into a short, deduplicated alert queue that clears itself (UI-side only; never feeds the sim). */
export function createAlerts(sim: Sim): Alerts {
  const store = createStore<UiAlert[]>([]);
  const keys = new Map<number, string>();
  const resolvers = new Map<number, () => boolean>();
  let nextId = 1;
  /** Arrival-warning alerts by fleet id. They follow the sim, so they never expire on a timer. */
  const incoming = new Map<number, number>();
  let incomingKey = '';
  /** Fleets whose warning the player dismissed: quiet until the fleet is no longer on its way. */
  const muted = new Set<number>();

  const crewName = (id: number) => sim.world.get(id, CrewC)?.name ?? 'Crew';
  const home = () => homeShip(sim);
  const playerSuit = (id: number) => sim.world.get(id, AllegianceC)?.faction === 'player';
  const alive = (id: number) => sim.world.has(id, CrewC);
  /** Hostile ships and their crew raise no alerts of their own (a player crew member going down anywhere does). */
  const foreign = (e: SimEvent): boolean => {
    if (e.type === 'fire.started' || e.type === 'hull.breach' || e.type === 'power.shortage' || e.type === 'o2.low') return e.ship !== home();
    if (e.type === 'crew.downed') return !playerSuit(e.crew) && shipIdOf(sim, sim.world.get(e.crew, PositionC)) !== home();
    return false;
  };

  const roomHas = (ship: number, room: number, test: (grid: NonNullable<ReturnType<typeof shipGrid>>, i: number) => boolean): boolean => {
    const grid = shipGrid(sim, ship);
    const tiles = grid ? roomTiles(grid).get(room) : undefined;
    return !!grid && !!tiles && tiles.some((i) => test(grid, i));
  };
  const burning = (ship: number, room: number) => roomHas(ship, room, (g, i) => (g.load('fire')[i] as number) > 0);
  const venting = (ship: number, room: number) => roomHas(ship, room, (g, i) => {
    const s = g.load('struct');
    const w = g.width;
    const x = i % w;
    return (x > 0 && s[i - 1] === Struct.Space) || (x < w - 1 && s[i + 1] === Struct.Space) || (i >= w && s[i - w] === Struct.Space) || (i + w < s.length && s[i + w] === Struct.Space);
  });
  const thin = (ship: number, room: number) => {
    const grid = shipGrid(sim, ship);
    const tiles = grid ? roomTiles(grid).get(room) : undefined;
    if (!grid || !tiles?.length) return false;
    const o2 = grid.load('o2');
    let sum = 0;
    for (const i of tiles) sum += o2[i] as number;
    return sum / tiles.length <= O2_ALERT_CLEAR_ABOVE;
  };
  const shortOnPower = (ship: number) => {
    let supply = 0;
    let demand = 0;
    for (const id of sim.world.query(ModuleC)) {
      const m = sim.world.get(id, ModuleC);
      if (!m || !m.enabled || m.hp <= 0 || shipIdOf(sim, m) !== ship) continue;
      const p = sim.content.modules[m.def]?.power ?? 0;
      if (p > 0) supply += p; else demand -= p;
    }
    return demand > supply;
  };

  /** "Under attack: Raider": the enemy's name, short. */
  const combatText = () => {
    const s = enemyShip(sim, home());
    const name = s?.kind === 'ship' ? sim.world.get(s.id, ShipC)?.name : undefined;
    return `Under attack${name ? `: ${name}` : ''}`;
  };

  function describe(e: SimEvent): Raised | null {
    if (!urgent(e.type) || foreign(e)) return null;
    switch (e.type) {
      case 'story.started': {
        const def = sim.content.events?.[e.event];
        if (!def || e.mode !== 'notice' || e.notice <= 0) return null;
        return { kind: 'story.lead', key: `ev${e.event}`, text: def.text, subject: null, notice: { id: e.notice, lead: true, title: def.title } };
      }
      case 'fire.started': return { kind: e.type, key: `f${e.room}`, text: 'Fire', subject: tileAt(e.x, e.y), resolved: () => !burning(e.ship, e.room) };
      case 'hull.breach': return { kind: e.type, key: `b${e.room}`, text: 'Hull breach', subject: roomOf(sim, e.ship, e.room), resolved: () => !venting(e.ship, e.room) };
      case 'power.shortage': return { kind: e.type, key: 'p', text: `Low power: ${Math.round(e.supply)} of ${Math.round(e.demand)}`, subject: powerSubject(), resolved: () => !shortOnPower(e.ship) };
      case 'o2.low': return { kind: e.type, key: `o${e.room}`, text: 'Low oxygen', subject: roomOf(sim, e.ship, e.room), resolved: () => thin(e.ship, e.room) === false };
      case 'crew.downed': return {
        kind: e.type, key: `d${e.crew}`, text: `Down: ${crewName(e.crew)}`, subject: crewSubject(sim, e.crew),
        // Back on their feet, stabilised (no longer bleeding out), or gone (the death is in the log).
        resolved: () => !alive(e.crew) || !sim.world.has(e.crew, DownedC) || !!sim.world.get(e.crew, DownedC)?.stabilized,
      };
      case 'suit.airLow': case 'suit.airOut': {
        if (!playerSuit(e.crew)) return null;
        return { kind: e.type, key: `sa${e.crew}`, text: `${e.type === 'suit.airLow' ? 'Suit air low' : 'Suit air out'}: ${crewName(e.crew)}`, subject: crewSubject(sim, e.crew), resolved: () => !alive(e.crew) || !isSuited(sim, e.crew) };
      }
      case 'crew.starving': {
        if (!playerSuit(e.crew)) return null;
        return { kind: e.type, key: `st${e.crew}`, text: `Starving: ${crewName(e.crew)}`, subject: crewSubject(sim, e.crew), resolved: () => !alive(e.crew) || (sim.world.get(e.crew, NeedsC)?.hunger ?? 0) > 0 };
      }
      case 'eggsac.hatched': {
        const aliens = e.aliens;
        return { kind: 'creatures.aboard', key: `ca${e.ship}`, text: `Creatures aboard: ${sim.world.get(e.ship, ShipC)?.name ?? 'wreck'}`, subject: tileAt(e.x, e.y), resolved: () => !aliens.some(alive) };
      }
      case 'combat.started': return { kind: e.type, key: 'cs', text: combatText(), subject: enemyShip(sim, home()), resolved: () => !sim.sector.inCombat };
      default: return null;
    }
  }

  const powerSubject = (): UiSubject | null => {
    for (const id of sim.world.query(ModuleC)) {
      const m = sim.world.get(id, ModuleC);
      if (m && (sim.content.modules[m.def]?.power ?? 0) > 0 && shipIdOf(sim, m) === home()) return tileAt(m.x, m.y);
    }
    return null;
  };

  const remove = (id: number) => {
    keys.delete(id);
    resolvers.delete(id);
    store.update((l) => l.filter((a) => a.id !== id));
  };

  function syncIncoming(): void {
    const g = sim.galaxy;
    const key = `${g.rev}|${g.current}|${g.turn}`;
    if (key === incomingKey) return;
    incomingKey = key;
    // Only hostile arrivals are urgent; a friendly fleet dropping in is not an alert.
    const want = sim.content.galaxy ? incomingFleets(sim).filter((w) => w.hostile) : [];
    const ids = new Set(want.map((w) => w.fleet));
    for (const fleet of muted) if (!ids.has(fleet)) muted.delete(fleet);
    for (const [fleet, id] of incoming) {
      if (ids.has(fleet) && store.get().some((a) => a.id === id)) continue;
      if (ids.has(fleet)) muted.add(fleet);
      incoming.delete(fleet);
      remove(id);
    }
    for (const w of want) {
      if (muted.has(w.fleet)) continue;
      const text = `Arriving: ${w.name}, ${w.eta} turn${w.eta === 1 ? '' : 's'}`;
      const id = incoming.get(w.fleet);
      if (id !== undefined) {
        store.update((l) => l.map((a) => (a.id === id ? { ...a, text } : a)));
        continue;
      }
      const nid = nextId++;
      incoming.set(w.fleet, nid);
      store.update((l) => [{ id: nid, kind: 'galaxy.incomingHostile', text, subject: { kind: 'node', id: g.current } }, ...l]);
      for (let l = store.get(); l.length > MAX; l = store.get()) remove((l[l.length - 1] as UiAlert).id);
    }
  }

  return {
    list: store,
    syncIncoming,
    get: (id) => store.get().find((a) => a.id === id),
    dismiss(id) {
      const n = store.get().find((a) => a.id === id)?.notice;
      if (n?.lead) sim.enqueue({ type: 'story.dismissNotice', notice: n.id });
      remove(id);
    },
    sync() {
      for (const [id, done] of resolvers) if (done()) remove(id);
    },
    onEvents(events) {
      for (const e of events) {
        const d = describe(e);
        if (!d) continue;
        for (const [id, k] of keys) if (k === d.key) remove(id);
        const id = nextId++;
        keys.set(id, d.key);
        store.update((l) => [{ id, kind: d.kind, text: d.text, subject: d.subject, ...(d.notice ? { notice: d.notice } : {}) }, ...l]);
        if (d.resolved) resolvers.set(id, d.resolved);
        else setTimeout(() => remove(id), EXPIRE_MS); // nothing to watch (a story lead): it lapses on a timer
        for (let l = store.get(); l.length > MAX; l = store.get()) remove((l[l.length - 1] as UiAlert).id);
      }
    },
  };
}
