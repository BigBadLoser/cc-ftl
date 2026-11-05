import { abortTask } from '../ai/task';
import { releaseBedOwner } from '../crew/beds';
import { applyEffect } from '../story/effects';
import { CrewC, DeadC, DownedC, PositionC } from '../crew/components';
import { AllegianceC } from '../fight/components';
import { turnCrew } from '../combat/turn';
import { hostileAct } from '../combat/provoke';
import { ShipC } from '../combat/components';
import { factionsHostile } from '../combat/factions';
import { pickAirlock, startParty } from '../boarding/party';
import { playerShipInfo } from '../galaxy/arrivals';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { AMBUSH_NO_DOCK_SEC, AMBUSH_SPRING_SEC, HONEST_STAY_SEC, VISIT_RETRY_TICKS } from '../tuning';
import { AboardC, BoarderC, EmbarkOrderC, VehicleC, type Boarder } from '../vehicles/components';
import type { Ambush, SceneShip, SceneSpec } from './types';

/**
 * A boarding trigger outside combat (DESIGN.md "Pirate ambush"). A scene skiff (a trap or honest, the same request) asks to dock a while after the scene opens; the player's
 * answer is the command `galaxy.visit`. Let in, its party goes by the ordinary boarding path (`startParty`, then `boardingAiSystem` flies the shuttle, docks it
 * and lands the party), only the ship is still neutral (`Boarder.visit`). Once they stand on the player's ship they pass for guests for AMBUSH_SPRING_SEC,
 * then the ship turns on the player through `hostileAct` (reason 'ambush'), which turns its group and its people, party included, and records the group
 * as every provocation does. Refused, a trap drops the act the same way. A player shot on the skiff (or on anything of its group) turns it first, by the
 * same rule. Nothing here is a parallel hostility record.
 */

const live = (sim: Sim, s: SceneShip): number | null => {
  const id = s.contact.ship;
  const ship = id === undefined ? undefined : sim.world.get(id, ShipC);
  return id !== undefined && ship && (ship.state === 'active' || ship.state === 'disabled') ? id : null;
};

/** The party is on the player's ship when one of them is standing on its grid. */
function partyAboard(sim: Sim, id: number): boolean {
  const me = playerShipInfo(sim)?.id;
  if (me === undefined) return false;
  return (sim.world.get(id, BoarderC)?.crew ?? []).some((c) => {
    const pos = sim.world.get(c, PositionC);
    return !!pos && shipIdOf(sim, pos) === me;
  });
}

/** Set the clock of the skiff's request when the scene opens (called by `openScene`). */
export function startVisitClock(sim: Sim, s: SceneShip): void {
  if (s.ambush) s.ambush.askAt = sim.tick + Math.round(s.ambush.askAfter * TICK_HZ);
}

/** True while the skiff's visit is a live question or a thing under way: it holds station (it neither jumps away nor is idle). */
export const visiting = (a: Ambush | undefined): boolean =>
  !!a && a.visit !== 'refused' && a.visit !== 'sprung' && !(a.visit === 'delivered' && a.home);

/** A visit in the phases that need the player's ship held: the dock granted, the party aboard, an honest party not yet home. */
const inProgress = (a: Ambush): boolean => a.visit === 'granted' || a.visit === 'aboard' || (a.visit === 'delivered' && !a.home);

/**
 * The player leaves the scene (`leaveEvent`): a visit in progress is settled here, never a reason to stay. Visitors on the player's ship: an honest
 * party is removed with a log line (what was delivered stays; not delivered yet, nothing comes and the debt is unpaid: `spared_pirate` cleared); a trap
 * party springs now through `hostileAct`, so it travels with the ship as ordinary hostile boarders. A party not yet out, or a shuttle in flight, is
 * cancelled and wiped with the scene. A skiff already wrecked, taken or gone settles as in `settleLost`.
 */
export function settleVisits(sim: Sim, spec: SceneSpec): void {
  const me = playerShipInfo(sim)?.id;
  for (const s of spec.ships) {
    const a = s.ambush;
    if (!a || !inProgress(a)) continue;
    const id = live(sim, s);
    if (id === null) {
      settleLost(sim, s, a);
      continue;
    }
    const party = (sim.world.get(id, BoarderC)?.crew ?? []).filter((c) => {
      const pos = sim.world.get(c, PositionC);
      return able(sim, c) && !!pos && me !== undefined && shipIdOf(sim, pos) === me;
    });
    const name = sim.world.get(id, ShipC)?.name ?? s.contact.name ?? 'The skiff';
    if (party.length > 0 && a.trap) turn(sim, a, id);
    else if (party.length > 0) {
      for (const c of party) {
        abortTask(sim, c, 'removed');
        releaseBedOwner(sim, c);
        sim.world.destroyEntity(c);
      }
      if (a.visit !== 'delivered') applyEffect(sim, { type: 'flag', flag: 'spared_pirate', op: 'clear' }, { event: spec.event ?? spec.key, actor: null });
      sim.events.emit({ type: 'scene.observed', rule: 'visitLeft', ship: id, text: `${name}'s crew take their leave`, tone: 'info' });
      a.visit = a.visit === 'delivered' ? 'delivered' : 'refused';
      a.home = true;
    } else {
      a.visit = a.trap ? 'refused' : a.visit === 'delivered' ? 'delivered' : 'refused';
      a.home = true;
    }
    dismiss(sim, s);
  }
}

/**
 * A visit whose skiff is wrecked, captured or gone is over. A party still standing aboard has just lost its ship to the player's hand or a stray shot:
 * they turn hostile (their owner's side), as any crew would, and from then on they are the ordinary boarders; with nobody aboard the visit is cancelled.
 */
function settleLost(sim: Sim, s: SceneShip, a: Ambush): void {
  const id = s.contact.ship;
  const party = id !== undefined && sim.world.has(id, BoarderC) ? sim.world.get(id, BoarderC)?.crew ?? [] : [];
  const me = playerShipInfo(sim)?.id;
  const aboard = party.some((c) => {
    const pos = sim.world.get(c, PositionC);
    return !sim.world.has(c, DeadC) && sim.world.get(c, AllegianceC)?.faction === 'neutral' && !!pos && me !== undefined && shipIdOf(sim, pos) === me;
  });
  if (id !== undefined && aboard) turnCrew(sim, id, 'neutral', sim.content.galaxy?.factions[s.contact.faction]?.combatFaction ?? 'hostile');
  a.visit = aboard ? 'sprung' : 'refused';
  delete s.hailed;
  s.dismissed = true;
}

/** True when the skiff's party member is alive and up (not dead, not downed). */
const able = (sim: Sim, c: number): boolean => sim.world.has(c, CrewC) && !sim.world.has(c, DeadC) && !sim.world.has(c, DownedC);

/**
 * Reconcile a granted visit with what is really in play, once a second: the shuttle stranded by an airlock that went down (the boarding system gave up
 * on it) is sent at a usable airlock again, a docked shuttle whose party never stepped out is told to unload. With no usable airlock for
 * AMBUSH_NO_DOCK_SEC the visit gives up (true; the shuttle is sent home): a trap turns on the player where it is, an honest skiff cancels.
 */
function reconcileGranted(sim: Sim, a: Ambush, b: Boarder): boolean {
  const v = b.vehicle ? sim.world.get(b.vehicle, VehicleC) : undefined;
  const lost = b.state === 'done' && (b.crew.length === 0 || !v);
  if (lost) return true;
  if (b.state !== 'done' || !v) return false;
  if (v.state === 'docked') {
    if (sim.tick % VISIT_RETRY_TICKS === 0 && b.crew.some((c) => sim.world.has(c, AboardC))) {
      sim.enqueue({ type: 'vehicle.disembark', vehicle: b.vehicle });
      if (v.pilot) sim.enqueue({ type: 'vehicle.disembark', vehicle: b.vehicle, crew: v.pilot });
    }
    return false;
  }
  if (pickAirlock(sim, b.vehicle) !== 0) {
    delete a.stuckSince;
    b.state = v.state === 'flying' ? 'sent' : 'loading'; // the boarding system docks it again
    return false;
  }
  a.stuckSince ??= sim.tick;
  if (sim.tick - a.stuckSince < AMBUSH_NO_DOCK_SEC * TICK_HZ) return false;
  if (v.state !== 'stowed') sim.enqueue({ type: 'vehicle.return', vehicle: b.vehicle });
  return true;
}

/**
 * Reconcile an honest party's way home, once a second: members not yet in the shuttle are (re)sent to it every VISIT_RETRY_TICKS (an order rejected
 * while the airlock was down is simply tried again); once all are seated the shuttle undocks and returns, and a shuttle that stopped short is told to
 * return again. True when the shuttle is home or gone. A shuttle that is not docked is sent to a usable airlock first. With no usable airlock the party waits aboard; nothing here has to make progress,
 * because leaving settles the visit (`settleVisits`).
 */
function reconcileHome(sim: Sim, a: Ambush, b: Boarder): boolean {
  const v = sim.world.get(b.vehicle, VehicleC);
  if (!v || v.state === 'stowed') return true;
  const retry = sim.tick % VISIT_RETRY_TICKS === 0;
  const waiting = b.crew.filter((c) => able(sim, c) && !sim.world.has(c, AboardC));
  if (waiting.length > 0) {
    // A shuttle that is not at an airlock (the old one was replaced or lost) is sent to a usable one before the party is sent to it.
    if (v.state !== 'docked') {
      const airlock = retry && v.state === 'flying' && !v.dest ? pickAirlock(sim, b.vehicle) : 0;
      if (airlock) sim.enqueue({ type: 'vehicle.dock', vehicle: b.vehicle, airlock });
      return false;
    }
    if (retry) for (const crew of waiting) if (!sim.world.has(crew, EmbarkOrderC)) sim.enqueue({ type: 'vehicle.embark', crew, vehicle: b.vehicle });
    return false;
  }
  if (v.state === 'docked') {
    sim.enqueue({ type: 'vehicle.undock', vehicle: b.vehicle });
    sim.enqueue({ type: 'vehicle.return', vehicle: b.vehicle });
  } else if (retry && v.state === 'flying' && !v.dest) sim.enqueue({ type: 'vehicle.return', vehicle: b.vehicle });
  return false;
}

/** Let the skiff move on: it is no longer held, and its business here is done now. */
function dismiss(sim: Sim, s: SceneShip): void {
  delete s.hailed;
  s.dismissed = true; // a hail answered earlier would otherwise re-hold it (`departScene`)
  s.leaveAt = sim.tick;
}

/**
 * Once a second in the event grid: a request comes due, a let-in party that landed stands aboard, then a trap's turns on you, or an honest party pays its
 * debt (the observer sees `delivered`), stays a moment and goes home in its shuttle.
 */
export function tendVisit(sim: Sim, spec: SceneSpec): boolean {
  let changed = false;
  for (const s of spec.ships) {
    const a = s.ambush;
    const id = live(sim, s);
    if (!a) continue;
    if (id === null) {
      if (inProgress(a)) {
        settleLost(sim, s, a);
        changed = true;
      }
      continue;
    }
    const ship = sim.world.get(id, ShipC);
    if (!ship || a.visit === 'refused' || a.visit === 'sprung' || (a.visit === 'delivered' && a.home)) continue;
    // The player's shot (or anything of its group turning) got there first: it is hostile already, the party with it.
    if (ship.provoked !== undefined || factionsHostile(ship.faction, 'player')) {
      a.visit = 'sprung';
      changed = true;
      continue;
    }
    const b = sim.world.get(id, BoarderC);
    // Nobody left alive of the party that was sent: the visit is over (the empty shuttle stays where it is and goes with the scene).
    if (inProgress(a) && b && b.crew.length > 0 && b.crew.every((c) => !sim.world.has(c, CrewC) || sim.world.has(c, DeadC))) {
      if (a.trap) turn(sim, a, id);
      else if (a.visit === 'delivered') a.home = true;
      else a.visit = 'refused';
      if (!a.trap) dismiss(sim, s);
      changed = true;
      continue;
    }
    if (a.visit === undefined && a.askAt !== undefined && sim.tick >= a.askAt && playerShipInfo(sim)) {
      a.visit = 'asked';
      sim.events.emit({ type: 'scene.dockAsked', ship: id });
      changed = true;
    } else if (a.visit === 'granted') {
      if (b?.state === 'idle') startParty(sim, id, b); // also while no airlock is free: try again
      if (partyAboard(sim, id)) {
        a.visit = 'aboard';
        delete a.stuckSince;
        a.springAt = sim.tick + Math.round(AMBUSH_SPRING_SEC * TICK_HZ);
        changed = true;
      } else if (b && reconcileGranted(sim, a, b)) {
        // nobody could be sent, the shuttle was lost, or no airlock came back in time: the visit gives up
        if (a.trap) turn(sim, a, id);
        else {
          a.visit = 'refused';
          dismiss(sim, s);
        }
        changed = true;
      }
    } else if (a.visit === 'aboard' && a.springAt !== undefined && sim.tick >= a.springAt) {
      if (a.trap) turn(sim, a, id);
      else {
        a.visit = 'delivered'; // the observer's `delivered` rule hands over what he owed
        a.springAt = sim.tick + Math.round(HONEST_STAY_SEC * TICK_HZ);
      }
      changed = true;
    } else if (a.visit === 'delivered' && b) {
      if (!a.leaving && a.springAt !== undefined && sim.tick >= a.springAt) a.leaving = true;
      else if (a.leaving && reconcileHome(sim, a, b)) {
        a.home = true;
        dismiss(sim, s);
        changed = true;
      }
    }
  }
  return changed;
}

function turn(sim: Sim, a: Ambush, id: number): void {
  a.visit = 'sprung';
  hostileAct(sim, id, 'ambush');
}

/** The player's answer to a request to dock (`galaxy.visit`). Rejected when no skiff of the scene has one open. */
export function answerVisit(sim: Sim, ship: number, grant: boolean): void {
  const s = sim.galaxy.event?.scene.ships.find((x) => x.contact.ship === ship);
  const reject = (reason: string): void => void sim.events.emit({ type: 'command.rejected', command: 'galaxy.visit', reason });
  if (!s?.ambush || s.ambush.visit !== 'asked') return reject('noRequest');
  const a = s.ambush;
  if (!grant) {
    a.visit = 'refused';
    if (a.trap) hostileAct(sim, ship, 'ambush'); // the act is dropped
    else dismiss(sim, s); // an honest skiff pulls away, the debt unpaid
    sim.galaxy.rev++;
    return;
  }
  const b = sim.world.get(ship, BoarderC);
  if (!b) return reject('noParty');
  a.visit = 'granted';
  b.visit = true; // `tendVisit` sends the party (from a system, so its embark orders are in place before the boarding system next looks)
  sim.galaxy.rev++;
}

/** Debug: the open signal's ambush skiff is a trap (or honest) whatever its seed rolled, with the talk and crew that goes with it. */
export function setAmbush(sim: Sim, trap: boolean): void {
  const spec = sim.galaxy.signal;
  const recipe = spec?.event ? sim.content.events?.[spec.event]?.scene?.ships : undefined;
  spec?.ships.forEach((s, i) => {
    const r = recipe?.[i]?.ambush;
    if (!s.ambush || !r) return;
    s.ambush = { trap, party: trap ? r.party : r.honest.party[0], talk: trap ? r.talk.trap : r.talk.honest, askAfter: s.ambush.askAfter, ...(trap ? { tell: 'lag' as const } : {}) };
    if (trap) s.ambush.talk = r.talk.tells.lag;
    s.crew = trap ? r.crew[0] : r.honest.crew[0];
  });
}
