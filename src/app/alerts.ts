import { shipIdOf, shipGrid } from '../sim/regions';
import { AllegianceC, CrewC, ModuleC, PositionC, ShipC, TraderC, roomTiles, type Grid, type Sim, type SimEvent } from '../sim';
import type { UiAlert, UiAlertKind } from '../ui/api';
import { createStore, type Readable } from './store';

const MAX = 6;
const EXPIRE_MS = 45000;

export interface Alerts {
  list: Readable<UiAlert[]>;
  onEvents(events: SimEvent[]): void;
  dismiss(id: number): void;
  get(id: number): UiAlert | undefined;
  /** True when this event raises (or would raise) an alert, so the event log can leave it to the alert. */
  covers(e: SimEvent): boolean;
  /** Called whenever an alert leaves the list (dismissed, expired or replaced), with the tick it appeared. */
  onCleared(fn: (a: UiAlert, tick: number, replaced: boolean) => void): void;
  /** Called for each event that raised a new alert, with that alert's id. */
  onRaised(fn: (e: SimEvent, alertId: number) => void): void;
}

/** Turns sim events into a short, deduplicated, dismissable alert queue (UI-side only; never feeds the sim). */
const BLOCKED = { noShuttle: 'no free shuttle', noPilot: 'no free pilot', noAirlock: 'no working airlock', noStock: 'nothing left to take', failed: 'trips keep failing' } as const;

export function createAlerts(sim: Sim): Alerts {
  const store = createStore<UiAlert[]>([]);
  const keys = new Map<number, string>();
  const born = new Map<number, number>();
  const clearedFns: ((a: UiAlert, tick: number, replaced: boolean) => void)[] = [];
  const raisedFns: ((e: SimEvent, alertId: number) => void)[] = [];
  let nextId = 1;

  const crewName = (id: number) => sim.world.get(id, CrewC)?.name ?? 'Crew';
  const crewAt = (id: number) => {
    const p = sim.world.get(id, PositionC);
    return p ? { x: p.x, y: p.y } : null;
  };
  const roomCentre = (grid: Grid | undefined, room: number) => {
    const tiles = grid ? roomTiles(grid).get(room) : undefined;
    if (!grid || !tiles?.length) return null;
    let sx = 0;
    let sy = 0;
    for (const i of tiles) {
      sx += grid.x0 + (i % grid.width);
      sy += grid.y0 + Math.floor(i / grid.width);
    }
    return { x: sx / tiles.length, y: sy / tiles.length };
  };
  /** The player's ship (home grid 1), as a ShipC entity id. */
  const home = () => 1;
  const shipName = (ship: number) => sim.world.get(ship, ShipC);
  const shipCentre = (ship: number) => { const s = sim.world.get(ship, ShipC); return s ? { x: Math.floor(s.x + s.width / 2), y: Math.floor(s.y + s.height / 2) } : null; };
  const reactorAt = () => {
    for (const id of sim.world.query(ModuleC)) {
      const m = sim.world.get(id, ModuleC);
      if (m && (sim.content.modules[m.def]?.power ?? 0) > 0) return { x: m.x, y: m.y };
    }
    return null;
  };

  const traderName = (id: number) => sim.world.get(id, TraderC)?.name ?? 'trader';
  const playerSuit = (id: number) => sim.world.get(id, AllegianceC)?.faction === 'player';
  /** Hostile ships and their crew raise no alerts of their own (a player crew member going down anywhere does). */
  const foreign = (e: SimEvent): boolean => {
    if (e.type === 'fire.started' || e.type === 'hull.breach' || e.type === 'power.shortage' || e.type === 'o2.low') return e.ship !== home();
    // The player's own crew going down is news wherever they are (an away team on a derelict or an enemy ship).
    if (e.type === 'crew.downed' && playerSuit(e.crew)) return false;
    if (e.type === 'crew.downed' || e.type === 'crew.died' || e.type === 'crew.rescued') {
      return shipIdOf(sim, sim.world.get(e.crew, PositionC)) !== home();
    }
    return false;
  };

  function describe(e: SimEvent): { kind: UiAlertKind; key: string; text: string; at: UiAlert['at']; notice?: UiAlert['notice'] } | null {
    if (foreign(e)) return null;
    switch (e.type) {
      case 'story.started': {
        const def = sim.content.events?.[e.event];
        if (!def || e.mode !== 'notice') return null;
        const lead = e.notice > 0;
        return { kind: lead ? 'story.lead' : 'story.notice', key: `ev${e.event}`, text: def.text, at: null, notice: { id: e.notice, lead, title: def.title } };
      }
      case 'fire.started': return { kind: e.type, key: `f${e.room}`, text: 'Fire!', at: { x: e.x, y: e.y } };
      case 'hull.breach': return { kind: e.type, key: `b${e.room}`, text: 'Hull breach', at: roomCentre(shipGrid(sim, e.ship), e.room) };
      case 'power.shortage': return { kind: e.type, key: 'p', text: `Power shortage (${Math.round(e.supply)}/${Math.round(e.demand)})`, at: reactorAt() };
      case 'o2.low': return { kind: e.type, key: `o${e.room}`, text: 'Low oxygen', at: roomCentre(shipGrid(sim, e.ship), e.room) };
      case 'crew.downed': return { kind: e.type, key: `d${e.crew}`, text: `${crewName(e.crew)} is down`, at: crewAt(e.crew) };
      case 'crew.died': return { kind: e.type, key: `x${e.crew}`, text: `${crewName(e.crew)} died`, at: crewAt(e.crew) };
      case 'suit.airLow': return playerSuit(e.crew) ? { kind: e.type, key: `sa${e.crew}`, text: `${crewName(e.crew)}: suit air low`, at: crewAt(e.crew) } : null;
      case 'suit.airOut': return playerSuit(e.crew) ? { kind: e.type, key: `sa${e.crew}`, text: `${crewName(e.crew)}: suit out of air!`, at: crewAt(e.crew) } : null;
      case 'crew.starving': return playerSuit(e.crew) ? { kind: e.type, key: `st${e.crew}`, text: `${crewName(e.crew)} is starving`, at: crewAt(e.crew) } : null;
      case 'crew.moodLow': return playerSuit(e.crew) ? { kind: e.type, key: `ml${e.crew}`, text: `${crewName(e.crew)} is very unhappy`, at: crewAt(e.crew) } : null;
      case 'crew.rescued': return { kind: e.type, key: `r${e.crew}`, text: `${crewName(e.crew)} rescued`, at: crewAt(e.crew) };
      case 'job.missingMaterials':
        return { kind: e.type, key: `m${e.x},${e.y}`, text: `Missing ${sim.content.items[e.item]?.name ?? e.item}`, at: { x: e.x, y: e.y } };
      case 'storage.full':
        return { kind: e.type, key: `s${e.x},${e.y}`, text: `Storage full (${sim.content.items[e.item]?.name ?? e.item})`, at: { x: e.x, y: e.y } };
      case 'production.done':
        return { kind: e.type, key: `pd${e.module}`, text: `${sim.content.recipes[e.recipe]?.name ?? 'Batch'} done`, at: { x: e.x, y: e.y } };
      case 'eggsac.hatched': return { kind: 'creatures.aboard', key: `ca${e.ship}`, text: `Hostile creatures aboard ${shipName(e.ship)?.name ?? 'the wreck'}`, at: { x: e.x, y: e.y } };
      case 'combat.started': return { kind: e.type, key: 'cs', text: 'Hostile ship in range: combat!', at: null };
      case 'mining.waiting': return { kind: e.type, key: `mw${e.pod}`, text: 'Mining pod waits for a free pilot', at: null };
      case 'mining.done': return { kind: e.type, key: `md${e.pod}`, text: e.reason === 'exhausted' ? `Mining done: ore used up (${e.trips} trips)` : e.reason === 'recalled' ? 'Mining pod recalled' : 'Mining pod lost its bay', at: null };
      case 'transfer.queued': return e.auto ? { kind: 'transfer', key: `tq${e.order}`, text: `Salvage from ${shipName(e.from)?.name ?? 'a wreck'} queued for transfer`, at: null } : null;
      case 'transfer.delivered': return e.final ? { kind: 'transfer', key: `tq${e.order}`, text: `Transfer delivered to ${shipName(e.to)?.name ?? 'the destination'}`, at: null } : null;
      case 'transfer.blocked': return { kind: 'transfer', key: `tb${e.order}`, text: `Transfer blocked: ${BLOCKED[e.reason]}`, at: null };
      case 'outpost.discovered': return { kind: e.type, key: `od${e.ship}`, text: 'Hidden base discovered', at: shipCentre(e.ship) };
      case 'ship.provoked': return { kind: e.type, key: `op${e.ship}`, text: `${shipName(e.ship)?.name ?? 'Ship'} turns hostile`, at: shipCentre(e.ship) };
      case 'module.destroyed': {
        const s = shipName(e.ship);
        if (s?.faction !== 'player') return null;
        return { kind: e.type, key: `md${e.moduleId}`, text: `${sim.content.modules[e.def]?.name ?? 'Module'} destroyed`, at: null };
      }
      case 'ship.destroyed': {
        const s = shipName(e.ship);
        return s?.faction === 'player'
          ? { kind: 'ship.lost', key: 'sl', text: 'Your ship is destroyed', at: null }
          : { kind: e.type, key: `sd${e.ship}`, text: `${s?.name ?? 'Ship'} destroyed`, at: null };
      }
      case 'trade.hailAnswered': return { kind: 'trade', key: `th${e.ship}`, text: `${e.name} answers your hail`, at: null };
      case 'trade.hailRefused': return { kind: 'trade', key: `th${e.ship}`, text: `${e.name} will not talk to you`, at: null };
      case 'trade.dealMade': return { kind: 'trade', key: `td${e.deal}`, text: `Deal made with ${traderName(e.ship)}`, at: null };
      case 'trade.delivered': return { kind: 'trade', key: `td${e.deal}`, text: e.to === 'player' ? `Cargo from ${traderName(e.ship)} has arrived` : `Cargo delivered to ${traderName(e.ship)}`, at: null };
      case 'trade.settled': return { kind: 'trade', key: `td${e.deal}`, text: `Deal settled${e.credits ? `: ${e.credits > 0 ? '-' : '+'}${Math.abs(e.credits)} credits` : ''}`, at: null };
      case 'trade.failed': return { kind: 'trade', key: `td${e.deal}`, text: `Deal with ${traderName(e.ship)} called off`, at: null };
      case 'station.alarm': return { kind: e.type, key: `sa${e.ship}`, text: `Alarm on ${shipName(e.ship)?.name ?? 'the station'}: ${e.reason}`, at: null };
      case 'ship.fled': return { kind: e.type, key: `sf${e.ship}`, text: `${shipName(e.ship)?.name ?? 'Ship'} jumped away`, at: null };
      default: return null;
    }
  }

  /** `replaced`: a fresh alert for the same thing takes over, so the log waits for that one instead. */
  const remove = (id: number, replaced = false) => {
    const gone = store.get().find((a) => a.id === id);
    if (gone) for (const fn of clearedFns) fn(gone, born.get(id) ?? sim.tick, replaced);
    born.delete(id);
    keys.delete(id);
    store.update((l) => l.filter((a) => a.id !== id));
  };

  return {
    list: store,
    get: (id) => store.get().find((a) => a.id === id),
    covers: (e) => describe(e) !== null,
    onCleared: (fn) => void clearedFns.push(fn),
    onRaised: (fn) => void raisedFns.push(fn),
    dismiss(id) {
      const n = store.get().find((a) => a.id === id)?.notice;
      if (n?.lead) sim.enqueue({ type: 'story.dismissNotice', notice: n.id });
      remove(id);
    },
    onEvents(events) {
      for (const e of events) {
        const d = describe(e);
        if (!d) continue;
        for (const [id, k] of keys) if (k === d.key) remove(id, true);
        const id = nextId++;
        keys.set(id, d.key);
        born.set(id, sim.tick);
        store.update((l) => [{ id, kind: d.kind, text: d.text, at: d.at, ...(d.notice ? { notice: d.notice } : {}) }, ...l]);
        for (const fn of raisedFns) fn(e, id);
        // The oldest alert falls off a full queue: that is a clearing like any other, so it reaches the log.
        for (let l = store.get(); l.length > MAX; l = store.get()) remove((l[l.length - 1] as UiAlert).id);
        setTimeout(() => remove(id), EXPIRE_MS);
      }
      for (const id of [...keys.keys()]) if (!store.get().some((a) => a.id === id)) keys.delete(id);
    },
  };
}
