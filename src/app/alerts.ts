import { homeShip, isOnOurSide } from '../sim/index';
import { hasLiveCore } from '../sim/robots/core';
import { shipIdOf, shipGrid } from '../sim/regions';
import { BreakdownC, CrewC, DeadC, DownedC, ModuleC, PickupC, NeedsC, PositionC, AllegianceC, ShipC, incomingFleets, isSuited, roomTiles, type Sim, type SimEvent } from '../sim';
import { Struct } from '../sim/structure';
import { O2_ALERT_CLEAR_ABOVE, ALERT_INTERVAL_TICKS } from '../sim/tuning';
import { AwayC, AwaySiteC } from '../sim/away/components';
import { pendingAsks } from '../sim/galaxy/joinOffer';
import { deriveAlerts, shortOnPower, powerSubject, powerAlertText, hazardKey, alertShips, shipHelpless, DERIVED_KINDS, type Wanted } from './alertsDerived';
import { ALERT_PRIORITY, raisesAlert } from './eventRoute';
import { passengerName } from './jobsSnapshot';
import type { UiAlert, UiAlertKind, UiSubject } from '../ui/api';
import { breakWhat } from './breakText';
import { recallReason } from './boardingText';
import { crewSubject, enemyShip, roomOf, shipSubject, tileAt } from './subjects';
import { createStore, type Readable } from './store';

const MAX = 6;
const priority = (a: Pick<UiAlert, 'kind'>) => ALERT_PRIORITY[a.kind];

/** Alerts are for urgent, actionable things only; where each event goes (log, or log and alert) is the one table in eventRoute.ts. Each urgent alert needs a jump target (`subject`) and a way to clear itself once the condition is resolved (`resolved`, polled by `sync`). */

export interface Alerts {
  list: Readable<UiAlert[]>;
  onEvents(events: SimEvent[]): void;
  dismiss(id: number): void;
  get(id: number): UiAlert | undefined;
  /** Arrival warnings: bring the "drops from hyperspace" alerts in line with the fleets now on their way to the player's node (state, not events). */
  syncIncoming(): void;
  /** Raise an alert that is not a reaction to one event (the fight report); it stays until dismissed or `clear`ed. */
  post(a: { kind: UiAlertKind; key: string; text: string; report?: boolean; menu?: 'save' }): void;
  /**
   * A save write finished. A failure raises the save-failed alert, unless the player dismissed it earlier in this streak of failures; a success
   * clears it and un-mutes it. Returns true when a new failure streak starts (the caller logs it once).
   */
  saveResult(ok: boolean, text: string): boolean;
  /** Remove the alerts raised under a key. */
  clear(key: string): void;
  /**
   * Clear every alert whose condition has resolved (combat over, fire out, crew member stabilised...), and bring the join asks in line with the sim (one
   * alert per passenger whose ask waits, from saved state, so a reload brings them back). Cheap; call it every few frames.
   */
  sync(): void;
}

interface Raised { kind: UiAlertKind; key: string; text: string; subject: UiSubject | null; resolved?: () => boolean; notice?: UiAlert['notice']; actions?: UiAlert['actions'] }

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
  const alive = (id: number) => sim.world.has(id, CrewC) && !sim.world.has(id, DeadC);
  /** Hostile ships and their crew raise no alerts of their own: hazards count on any ship the player owns, "down" only for the player's side. */
  const foreign = (e: SimEvent): boolean => {
    if (e.type === 'fire.started' || e.type === 'hull.breach' || e.type === 'o2.low') return !alertShips(sim, e.ship);
    if (e.type === 'power.shortage') return e.ship !== home();
    if (e.type === 'crew.downed') return !isOnOurSide(sim, e.crew);
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
  /** "Under attack: Raider": the enemy's name, short. */
  const combatText = () => {
    const s = enemyShip(sim, home());
    const name = s?.kind === 'ship' ? sim.world.get(s.id, ShipC)?.name : undefined;
    return `Under attack${name ? `: ${name}` : ''}`;
  };

  function describe(e: SimEvent): Raised | null {
    if (!raisesAlert(e.type) || foreign(e)) return null;
    switch (e.type) {
      case 'story.started': {
        const def = sim.content.events?.[e.event];
        if (!def || e.mode !== 'notice' || e.notice <= 0) return null;
        return { kind: 'story.lead', key: `ev${e.event}`, text: def.text, subject: null, notice: { id: e.notice, lead: true, title: def.title }, resolved: () => !sim.story.notices.some((n) => n.id === e.notice) };
      }
      case 'fire.started': return { kind: e.type, key: hazardKey(sim, 'f', e.ship, e.room), text: 'Fire', subject: tileAt(e.x, e.y), resolved: () => !burning(e.ship, e.room) };
      case 'hull.breach': return { kind: e.type, key: hazardKey(sim, 'b', e.ship, e.room), text: 'Hull breach', subject: roomOf(sim, e.ship, e.room), resolved: () => !venting(e.ship, e.room) };
      case 'power.shortage': return { kind: e.type, key: 'p', text: powerAlertText(sim, e.ship), subject: powerSubject(sim), resolved: () => !shortOnPower(sim, e.ship) };
      case 'o2.low': return { kind: e.type, key: hazardKey(sim, 'o', e.ship, e.room), text: 'Low oxygen', subject: roomOf(sim, e.ship, e.room), resolved: () => thin(e.ship, e.room) === false };
      case 'crew.downed': return {
        kind: e.type, key: `d${e.crew}`, text: `Down: ${crewName(e.crew)}`, subject: crewSubject(sim, e.crew),
        // Back on their feet, stabilised (no longer bleeding out), or gone (the death is in the log).
        resolved: () => !alive(e.crew) || !sim.world.has(e.crew, DownedC) || !!sim.world.get(e.crew, DownedC)?.stabilized,
      };
      case 'suit.airLow': case 'suit.airOut': {
        if (!playerSuit(e.crew)) return null;
        return { kind: e.type, key: `sa${e.crew}`, text: `${e.type === 'suit.airLow' ? 'Suit air low' : 'Suit air out'}: ${crewName(e.crew)}`, subject: crewSubject(sim, e.crew), resolved: () => !alive(e.crew) || !isSuited(sim, e.crew) };
      }
      case 'crew.airUnreachable': {
        // No air source in reach (#286): the pickup request is out; a shuttle answers it (the site's own, or a pickup run).
        if (!playerSuit(e.crew)) return null;
        const left = `${Math.floor(e.sec / 60)}:${String(e.sec % 60).padStart(2, '0')}`;
        return { kind: e.type, key: `au${e.crew}`, text: `No air in reach: ${crewName(e.crew)} (${left} left)`, subject: crewSubject(sim, e.crew), resolved: () => !alive(e.crew) || !sim.world.has(e.crew, PickupC) };
      }
      case 'away.stranded': {
        // The away site's shuttle is lost and no other free one can come (#286), or it has no way into its home ship (bay down, no free
        // airlock): the party waits until a shuttle or a way in is back.
        const ship = e.ship;
        return {
          kind: e.type, key: `as${ship}`, text: `${e.noHome ? 'Shuttle cannot get home' : 'Crew stranded'}: ${sim.world.get(ship, ShipC)?.name ?? 'away site'}`, subject: e.crew[0] ? crewSubject(sim, e.crew[0]) : null,
          resolved: () => sim.world.get(ship, AwaySiteC)?.block !== 'stranded',
        };
      }
      case 'crew.break': {
        if (!e.alert || !playerSuit(e.crew)) return null;
        // Clears itself when the break ends (the sim's `crew.breakEnded`).
        return { kind: e.type, key: `br${e.crew}`, text: `${crewName(e.crew)} ${breakWhat(e.kind, e.context)}`, subject: crewSubject(sim, e.crew), resolved: () => !alive(e.crew) || !sim.world.has(e.crew, BreakdownC) };
      }
      case 'crew.starving': {
        if (!playerSuit(e.crew)) return null;
        return { kind: e.type, key: `st${e.crew}`, text: `Starving: ${crewName(e.crew)}`, subject: crewSubject(sim, e.crew), resolved: () => !alive(e.crew) || (sim.world.get(e.crew, NeedsC)?.hunger ?? 0) > 0 };
      }
      case 'eggsac.hatched': {
        const aliens = e.aliens;
        return { kind: 'creatures.aboard', key: `ca${e.ship}`, text: `Creatures aboard: ${sim.world.get(e.ship, ShipC)?.name ?? 'wreck'}`, subject: tileAt(e.x, e.y), resolved: () => !aliens.some(alive) };
      }
      case 'crew.recallStarted': case 'crew.recallFailed': {
        // Boarders who could not be brought home are still on the enemy ship: urgent while they stand there.
        const stuck = e.type === 'crew.recallStarted' ? e.left : e.crew.map((crew) => ({ crew, reason: e.reason }));
        const first = stuck[0];
        if (!first) return null;
        const ids = stuck.map((l) => l.crew);
        const reasons = [...new Set(stuck.map((l) => recallReason(l.reason)))].join(', ');
        const text = `Left behind: ${ids.map(crewName).join(', ')} (${reasons})`;
        const aboard = (id: number) => alive(id) && shipIdOf(sim, sim.world.get(id, PositionC)) !== home();
        return { kind: 'boarders.stranded', key: `rl${shipIdOf(sim, sim.world.get(first.crew, PositionC))}`, text, subject: crewSubject(sim, first.crew), resolved: () => !ids.some(aboard) };
      }
      case 'ship.disabled': {
        if (e.ship !== home() || !shipHelpless(sim, e.ship)) return null;
        return { kind: 'ship.disabled', key: `sd${e.ship}`, text: 'Ship disabled: no able crew or power', subject: shipSubject(sim, e.ship), resolved: () => !shipHelpless(sim, e.ship) };
      }
      case 'vehicle.destroyed': {
        // The shuttle's people: those inside went down or died with it, the rest of its party are out with no ride home.
        const people = [...e.aboard, ...e.away];
        if (e.faction !== 'player' || !people.length) return null;
        const trouble = (c: number) => alive(c) && ((!!sim.world.get(c, DownedC) && !sim.world.get(c, DownedC)?.stabilized) || sim.world.get(c, AwayC)?.vehicle === e.vehicle);
        const first = people.find(trouble) ?? people[0] as number;
        const text = `Shuttle lost: ${e.aboard.length ? `${e.aboard.length} aboard` : ''}${e.aboard.length && e.away.length ? ', ' : ''}${e.away.length ? `${e.away.length} away` : ''}`;
        return { kind: 'vehicle.lost', key: `vl${e.vehicle}`, text, subject: crewSubject(sim, first) ?? tileAt(e.x, e.y), resolved: () => !people.some(trouble) };
      }
      case 'core.torn': case 'core.hacked': {
        if (e.ship !== home() || (e.type === 'core.hacked' && e.by === 'player')) return null;
        const text = e.type === 'core.torn' ? 'AI core torn out: robots shut down' : 'AI core hacked: robots shut down';
        const core = e.type === 'core.hacked' ? sim.world.get(e.moduleId, ModuleC) : undefined;
        return { kind: 'core.lost', key: `core${e.ship}`, text, subject: core ? tileAt(core.x, core.y) : shipSubject(sim, e.ship), resolved: () => hasLiveCore(sim, e.ship) };
      }
      case 'combat.started': return { kind: e.type, key: 'cs', text: combatText(), subject: enemyShip(sim, home()), resolved: () => !sim.sector.inCombat };
      default: return null;
    }
  }

  let saveFailing = false;
  let saveMuted = false;
  /** Alerts the cap pushed out (not dismissed by the player): their syncs forget them without muting. */
  const evicted = new Set<number>();
  const remove = (id: number) => {
    keys.delete(id);
    resolvers.delete(id);
    store.update((l) => l.filter((a) => a.id !== id));
  };

  /** Keep at most MAX alerts: the lowest priority goes first, the oldest within it (the list is newest first), so an emergency always has a slot. */
  function trim(): void {
    for (let l = store.get(); l.length > MAX; l = store.get()) {
      let drop = l[l.length - 1] as UiAlert;
      for (let i = l.length - 1; i >= 0; i--) if (priority(l[i] as UiAlert) < priority(drop)) drop = l[i] as UiAlert;
      evicted.add(drop.id);
      remove(drop.id);
    }
  }
  /** Whether a state-born alert of this kind may take a slot now: a free one, or one held by something less important. Never churns an equal. */
  const canRaise = (kind: UiAlertKind) => store.get().length < MAX || store.get().some((a) => priority(a) < ALERT_PRIORITY[kind]);

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
      if (ids.has(fleet) && !evicted.has(id)) muted.add(fleet);
      incoming.delete(fleet);
      remove(id);
    }
    for (const w of want) {
      if (muted.has(w.fleet)) continue;
      if (!incoming.has(w.fleet) && !canRaise('galaxy.incomingHostile')) continue;
      const text = `Arriving: ${w.name}, ${w.eta} turn${w.eta === 1 ? '' : 's'}`;
      const id = incoming.get(w.fleet);
      if (id !== undefined) {
        store.update((l) => l.map((a) => (a.id === id ? { ...a, text } : a)));
        continue;
      }
      const nid = nextId++;
      incoming.set(w.fleet, nid);
      store.update((l) => [{ id: nid, kind: 'galaxy.incomingHostile', text, subject: { kind: 'node', id: g.current } }, ...l]);
      trim();
    }
  }

  /** Join-ask alerts by passenger, and those the player dismissed (quiet until that ask is answered or lapses). */
  const asks = new Map<number, number>();
  const askMuted = new Set<number>();
  function syncAsks(): void {
    const want = new Set(pendingAsks(sim));
    for (const c of askMuted) if (!want.has(c)) askMuted.delete(c);
    for (const [c, id] of asks) {
      if (want.has(c) && store.get().some((a) => a.id === id)) continue;
      if (want.has(c) && !evicted.has(id)) askMuted.add(c); // dismissed with the X
      asks.delete(c);
      remove(id);
    }
    for (const c of want) {
      if (asks.has(c) || askMuted.has(c) || !canRaise('crew.asksToJoin')) continue;
      const id = nextId++;
      asks.set(c, id);
      const actions: UiAlert['actions'] = [
        { label: 'Accept', tone: 'good', command: { type: 'jobs.join', crew: c, accept: true } },
        { label: 'Decline', tone: 'bad', command: { type: 'jobs.join', crew: c, accept: false } },
      ];
      store.update((l) => [{ id, kind: 'crew.asksToJoin', text: `${passengerName(sim, c)} asks to join the crew`, subject: crewSubject(sim, c), actions }, ...l]);
      trim();
    }
  }

  /** Alerts raised from state (see `deriveAlerts`) by key, and the keys the player dismissed: quiet until the condition clears. */
  const derived = new Map<string, number>();
  const derivedMuted = new Map<string, UiAlertKind>(); // dismissed key -> the kind dismissed, so a worse kind on the same key (suit air out after low) still raises
  const hasKey = (k: string) => [...keys.values()].includes(k);
  let scannedAt = -Infinity;
  function syncDerived(): void {
    // The scan walks the home grid: once per alert interval of sim time (and at once after a load, when the tick differs).
    if (sim.tick === scannedAt || (sim.tick > scannedAt && sim.tick - scannedAt < ALERT_INTERVAL_TICKS)) return;
    scannedAt = sim.tick;
    const want = deriveAlerts(sim, (k) => hasKey(k) || derivedMuted.has(k)); // a dismissed alert keeps its hysteresis too
    for (const [k, kind] of derivedMuted) if (want.get(k)?.kind !== kind) derivedMuted.delete(k);
    for (const [k, id] of derived) {
      const w = want.get(k);
      const shown = store.get().find((a) => a.id === id);
      if (w && keys.get(id) === k && shown?.kind === w.kind) continue;
      derived.delete(k);
      if (!w || (shown && keys.get(id) === k)) remove(id); // gone, or worse/better kind on the same key (fuel low -> out): raised again below
    }
    for (const w of want.values()) {
      if (derivedMuted.get(w.key) === w.kind || hasKey(w.key) || !canRaise(w.kind)) continue;
      const id = nextId++;
      keys.set(id, w.key);
      derived.set(w.key, id);
      raise(id, w);
    }
  }
  const raise = (id: number, w: Wanted) => {
    store.update((l) => [{ id, kind: w.kind, text: w.text, subject: w.subject, ...(w.notice ? { notice: w.notice } : {}), ...(w.actions ? { actions: w.actions } : {}), ...(w.sticky ? { sticky: true as const } : {}) }, ...l]);
    trim();
  };

  return {
    list: store,
    syncIncoming,
    post(a) {
      for (const [id, k] of keys) if (k === a.key) remove(id);
      const id = nextId++;
      keys.set(id, a.key);
      store.update((l) => [{ id, kind: a.kind, text: a.text, subject: null, ...(a.report ? { report: true } : {}), ...(a.menu ? { menu: a.menu } : {}) }, ...l]);
      trim();
    },
    saveResult(ok, text) {
      if (ok) {
        saveFailing = false;
        saveMuted = false;
        this.clear('save');
        return false;
      }
      const starts = !saveFailing;
      saveFailing = true;
      if (!saveMuted) this.post({ kind: 'save.failed', key: 'save', text, menu: 'save' });
      return starts;
    },
    clear(key) {
      for (const [id, k] of keys) if (k === key) remove(id);
    },
    get: (id) => store.get().find((a) => a.id === id),
    dismiss(id) {
      if (store.get().find((a) => a.id === id)?.sticky) return; // a decision the game waits on: it goes once answered
      if (keys.get(id) === 'save') saveMuted = true; // dismissed: quiet until a write succeeds
      const shown = store.get().find((a) => a.id === id);
      const key = keys.get(id);
      if (shown && key && DERIVED_KINDS.has(shown.kind)) derivedMuted.set(key, shown.kind); // dismissed: quiet until its condition clears
      const n = store.get().find((a) => a.id === id)?.notice;
      if (n?.lead) sim.enqueue({ type: 'story.dismissNotice', notice: n.id });
      remove(id);
    },
    sync() {
      syncAsks(); // state, not events: a reload or a paused game still shows a waiting ask
      syncDerived();
      for (const [id, done] of resolvers) if (done()) remove(id);
    },
    onEvents(events) {
      for (const e of events) {
        const d = describe(e);
        if (!d) continue;
        if (DERIVED_KINDS.has(d.kind) && derivedMuted.get(d.key) === d.kind) continue; // dismissed: the event of a condition already muted stays quiet
        for (const [id, k] of keys) if (k === d.key) remove(id);
        const id = nextId++;
        keys.set(id, d.key);
        store.update((l) => [{ id, kind: d.kind, text: d.text, subject: d.subject, ...(d.notice ? { notice: d.notice } : {}), ...(d.actions ? { actions: d.actions } : {}) }, ...l]);
        if (d.resolved) resolvers.set(id, d.resolved);
        trim();
      }
    },
  };
}
