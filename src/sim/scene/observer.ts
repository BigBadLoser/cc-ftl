import { ShipC } from '../combat/components';
import { uninvitedOn } from '../consent/guests';
import { mended, pending, timerShip } from './clock';
import { CrewC, DeadC } from '../crew/components';
import { SalvageOrderC } from '../salvage/components';
import { hostileAboard } from '../salvage/system';
import { isSubdued } from '../fight/relations';
import { playerCrew } from '../story/world';
import { BoarderC } from '../vehicles/components';
import type { Sim } from '../sim';
import { applyEffect } from '../story/effects';
import type { EventEffect } from '../story/defs';
import { repKey } from '../galaxy/standing';
import type { Contact, EventGrid } from '../galaxy/types';
import type { Ambush, SceneDerelict, SceneFact, SceneRuleDef, SceneShip, Stance } from './types';

/**
 * The outcome observer (DESIGN.md "Physical encounters", part c). Once a second in an event grid it reads facts about the scene's ships from sim
 * state (never from the event stream, which is output only): a finished deal with it, a shot the player fired on it, player crew aboard,
 * taken, wrecked, fled; at leave, still there. Each rule (shared `sceneRules`, overridden per encounter) fires once per ship: its effects apply and its
 * log line goes out as `scene.observed`. No rule says how a scene ends; it only says what the world makes of what happened.
 */

/** A scene ship the observer watches: its descriptor and its stance (a fleet's ships all take the fleet's). */
interface Watched {
  contact: Contact;
  stance: Stance;
  ambush?: Ambush;
  /** The scene ship itself (a fleet's ships have none). */
  scene?: SceneShip;
}

function watched(ev: EventGrid): Watched[] {
  const out: Watched[] = ev.scene.ships.map((s) => ({ contact: s.contact, stance: s.stance, scene: s, ...(s.ambush ? { ambush: s.ambush } : {}) }));
  const stance = ev.scene.fleet?.stance ?? 'hostile';
  for (const c of ev.fleet?.ships ?? []) out.push({ contact: c, stance });
  return out;
}

/** Every player crew member seen alive in the grid so far (the ship is a packet until deployed, and crew may join): `crewLost` reads against it. */
function noteCrew(sim: Sim, ev: EventGrid): void {
  const seen = (ev.watch.crew ??= []);
  for (const c of playerCrew(sim)) if (!seen.includes(c)) seen.push(c);
}

/** The rules in force for a scene: the shared ones, with the encounter's own added or overriding them (null switches one off). Sorted by id. */
export function rulesFor(sim: Sim, ev: EventGrid): [string, SceneRuleDef][] {
  const own = ev.scene.event ? sim.content.events?.[ev.scene.event]?.scene?.rules : undefined;
  const all: Record<string, SceneRuleDef | null> = { ...(sim.content.sceneRules ?? {}), ...(own ?? {}) };
  return Object.entries(all).filter((e): e is [string, SceneRuleDef] => e[1] !== null).sort(([a], [b]) => (a < b ? -1 : 1));
}

/** The facts true of one ship right now. */
function factsOf(sim: Sim, ev: EventGrid, w: Watched): Set<SceneFact> {
  const out = new Set<SceneFact>();
  const id = w.contact.ship;
  const ship = id === undefined ? undefined : sim.world.get(id, ShipC);
  if (id === undefined || !ship) return out;
  if (sim.trade.deals.some((d) => d.ship === id && d.phase === 'done')) out.add('traded');
  // Fired on by the player: the shot that provoked it (aiming alone is nothing; a hit from someone else is not the player's doing).
  if (ship.provoked === 'fired') out.add('attacked');
  if (uninvitedOn(sim, id)) out.add('boarded');
  // Mended: the damage it started with is all repaired, by a player who never turned on it (its own crew cannot mend it: that is why it called).
  if (w.scene?.damaged?.length && !ship.provoked && ship.state !== 'wreck' && mended(sim, w.scene.damaged)) out.add('repaired');
  if (ship.state === 'prize') out.add('captured');
  if (ship.state === 'wreck') out.add('destroyed');
  if (ship.state === 'fled') out.add('fled');
  if ((sim.world.get(id, SalvageOrderC)?.done ?? 0) > 0) out.add('salvaged');
  if (w.ambush) {
    if (ship.provoked === 'ambush') out.add('ambushed');
    if (w.ambush.visit === 'delivered') out.add('delivered');
    if (w.ambush.visit === 'refused' && !w.ambush.trap) out.add('declined');
    // The party it sent is all dead or down (the player's shot or the ambush brought them out; either way they are done).
    const party = sim.world.get(id, BoarderC)?.crew ?? [];
    if (party.length > 0 && party.every((c) => !sim.world.has(c, CrewC) || isSubdued(sim, c))) out.add('boardersDown');
  }
  return out;
}

/**
 * The facts true of one derelict right now: a salvage order has stripped parts of it (or stripped it away: made, and gone now), and it is clear of
 * what was aboard when it was made.
 */
function derelictFacts(sim: Sim, d: SceneDerelict): Set<SceneFact> {
  const out = new Set<SceneFact>();
  if (d.ship === undefined) return out;
  if (!sim.world.has(d.ship, ShipC)) return out.add('salvaged');
  if ((sim.world.get(d.ship, SalvageOrderC)?.done ?? 0) > 0) out.add('salvaged');
  if (d.infested && !hostileAboard(sim, d.ship)) out.add('cleared');
  return out;
}

/** A rule's effects with 'owner' standing resolved to the ship owner's reputation key. */
const effectsFor = (sim: Sim, rule: SceneRuleDef, owner: string): EventEffect[] =>
  (rule.effects ?? []).map((e) => (e.type === 'reputation' && e.faction === 'owner' ? { ...e, faction: repKey(sim, owner) } : e));

/** What a rule fires about: a scene ship, a derelict, a crew member lost, or nothing (a timer). */
type Subject = { ship: Watched } | { derelict: SceneDerelict } | { crew: number } | null;

function fire(sim: Sim, ev: EventGrid, id: string, rule: SceneRuleDef, w: Subject): void {
  const key = !w ? id : 'ship' in w ? `${id}#${w.ship.contact.id}` : 'derelict' in w ? `${id}#d${w.derelict.id}` : `${id}#c${w.crew}`;
  if (ev.watch.fired.includes(key)) return;
  ev.watch.fired.push(key);
  const ctx = { event: ev.scene.event ?? ev.scene.key, actor: null };
  for (const eff of effectsFor(sim, rule, w && 'ship' in w ? w.ship.contact.faction : '')) applyEffect(sim, eff, { ...ctx, ...(w && 'ship' in w && w.ship.contact.ship !== undefined ? { ship: w.ship.contact.ship } : {}) });
  const shipId = !w ? 0 : 'ship' in w ? w.ship.contact.ship ?? 0 : 'derelict' in w ? w.derelict.ship ?? 0 : 0;
  const live = shipId && sim.world.has(shipId, ShipC) ? sim.world.get(shipId, ShipC)?.name : undefined;
  const name = !w ? '' : 'ship' in w ? live ?? w.ship.contact.name ?? 'the ship' : 'derelict' in w ? live ?? w.derelict.name : '';
  const crew = w && 'crew' in w ? sim.world.get(w.crew, CrewC)?.name ?? 'A crew member' : '';
  const text = (rule.log ?? '').replace('{ship}', name).replace('{crew}', crew);
  sim.events.emit({ type: 'scene.observed', rule: id, ship: shipId && sim.world.has(shipId, ShipC) ? shipId : 0, text, tone: rule.tone ?? 'info' });
}

const stanceOk = (rule: SceneRuleDef, w: Watched): boolean =>
  rule.of !== 'derelict' && (!rule.stance || rule.stance.includes(w.stance)) && (rule.trap === undefined || (!!w.ambush && w.ambush.trap === rule.trap));
const derelictOk = (rule: SceneRuleDef): boolean => rule.of !== 'ship' && !rule.stance && rule.trap === undefined;
const SCENE_WIDE = new Set<SceneFact>(['timer', 'left', 'crewLost', 'abandoned', 'doomed']);

/** Player crew alive when the scene opened who are dead now (or gone from the world, which only a death does inside the grid). */
const lostCrew = (sim: Sim, ev: EventGrid): number[] => (ev.watch.crew ?? []).filter((c) => sim.world.has(c, DeadC) || !sim.world.has(c, CrewC));

/** Once a second in the event grid: fire the rules whose facts are now true. */
export function observeScene(sim: Sim, ev: EventGrid): void {
  const rules = rulesFor(sim, ev);
  if (!rules.length) return;
  noteCrew(sim, ev);
  for (const w of watched(ev)) {
    const facts = factsOf(sim, ev, w);
    for (const [id, rule] of rules) if (!SCENE_WIDE.has(rule.on) && facts.has(rule.on) && stanceOk(rule, w)) fire(sim, ev, id, rule, { ship: w });
  }
  for (const d of ev.scene.derelicts) {
    const facts = derelictFacts(sim, d);
    for (const [id, rule] of rules) if (!SCENE_WIDE.has(rule.on) && facts.has(rule.on) && derelictOk(rule)) fire(sim, ev, id, rule, { derelict: d });
  }
  for (const c of lostCrew(sim, ev)) for (const [id, rule] of rules) if (rule.on === 'crewLost') fire(sim, ev, id, rule, { crew: c });
  for (const t of ev.scene.timers) {
    if (t.at === undefined || t.stopped || sim.tick < t.at) continue;
    // A timer about a ship fires about it (its name in the log, its owner's standing).
    const about = timerShip(ev.scene, t);
    const w = about ? watched(ev).find((x) => x.scene === about) : undefined;
    for (const [id, rule] of rules) if (rule.on === 'timer' && rule.timer === t.id) fire(sim, ev, id, rule, w ? { ship: w } : null);
  }
}

/** What leaving now leaves behind for a ship: help agreed and still under way (`abandoned`), a timer that blows it still running (`doomed`). */
function leaveFacts(ev: EventGrid, w: Watched): Set<SceneFact> {
  const out = new Set<SceneFact>();
  if (w.scene?.aid?.state === 'agreed') out.add('abandoned');
  if (ev.scene.timers.some((t) => t.due === 'wreck' && pending(t) && timerShip(ev.scene, t) === w.scene)) out.add('doomed');
  return out;
}

/** On leaving the grid: a last look, then the `left` rules for every ship still in play there and every derelict still there. */
export function observeLeave(sim: Sim, ev: EventGrid): void {
  observeScene(sim, ev);
  const rules = rulesFor(sim, ev).filter(([, r]) => r.on === 'left');
  const atLeave = rulesFor(sim, ev).filter(([, r]) => r.on === 'abandoned' || r.on === 'doomed');
  for (const w of watched(ev)) {
    const s = w.contact.ship === undefined ? undefined : sim.world.get(w.contact.ship, ShipC);
    if (!s || (s.state !== 'active' && s.state !== 'disabled')) continue;
    for (const [id, rule] of rules) if (stanceOk(rule, w)) fire(sim, ev, id, rule, { ship: w });
    const facts = leaveFacts(ev, w);
    for (const [id, rule] of atLeave) if (facts.has(rule.on) && stanceOk(rule, w)) fire(sim, ev, id, rule, { ship: w });
  }
  for (const d of ev.scene.derelicts) {
    if (d.ship === undefined || !sim.world.has(d.ship, ShipC)) continue;
    for (const [id, rule] of rules) if (derelictOk(rule)) fire(sim, ev, id, rule, { derelict: d });
  }
}
