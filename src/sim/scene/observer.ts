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
import type { EventGrid } from '../galaxy/types';
import type { SceneDerelict, SceneFact, SceneRuleDef } from './types';
import { fireRules, rulesOf, type RuleMemory, type Watched } from './rules';
import { handOn, podAdrift, podFacts } from './pods';

/**
 * The outcome observer (DESIGN.md "Physical encounters", part c). Once a second in an event grid it reads facts about the scene's ships from sim
 * state (never from the event stream, which is output only): a finished deal with it, a shot the player fired on it, player crew aboard,
 * taken, wrecked, fled; at leave, still there. Each rule (shared `sceneRules`, overridden per encounter) fires once per ship (scene/rules.ts `fireRules`):
 * its effects apply and its log line goes out as `scene.observed`. No rule says how a scene ends; it only says what the world makes of what happened.
 */

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

const rulesFor = (sim: Sim, ev: EventGrid): [string, SceneRuleDef][] => rulesOf(sim, ev.scene.event);
const memOf = (ev: EventGrid): RuleMemory => ({ event: ev.scene.event ?? ev.scene.key, fired: ev.watch.fired });

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

const stanceOk = (rule: SceneRuleDef, w: Watched): boolean =>
  (rule.of === undefined || rule.of === 'ship') && (!rule.stance || rule.stance.includes(w.stance)) && (rule.trap === undefined || (!!w.ambush && w.ambush.trap === rule.trap));
const derelictOk = (rule: SceneRuleDef): boolean => (rule.of === undefined || rule.of === 'derelict') && !rule.stance && rule.trap === undefined;
const podOk = (rule: SceneRuleDef): boolean => rule.of === 'pod';
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
    fireRules(sim, memOf(ev), rules, { ship: w }, (rule) => !SCENE_WIDE.has(rule.on) && facts.has(rule.on) && stanceOk(rule, w));
  }
  for (const d of ev.scene.derelicts) {
    const facts = derelictFacts(sim, d);
    fireRules(sim, memOf(ev), rules, { derelict: d }, (rule) => !SCENE_WIDE.has(rule.on) && facts.has(rule.on) && derelictOk(rule));
  }
  for (const p of ev.scene.pods ?? []) {
    const facts = podFacts(sim, p);
    fireRules(sim, memOf(ev), rules, { pod: p }, (rule) => facts.has(rule.on) && podOk(rule));
    // Taken in: from here on what happens to them is the passenger's to carry (scene/carried.ts), not the pocket's.
    if (facts.has('rescued')) handOn(sim, p, memOf(ev).event);
  }
  for (const c of lostCrew(sim, ev)) fireRules(sim, memOf(ev), rules, { crew: c }, (rule) => rule.on === 'crewLost');
  for (const t of ev.scene.timers) {
    if (t.at === undefined || t.stopped || sim.tick < t.at) continue;
    // A timer about a ship fires about it (its name in the log, its owner's standing).
    const about = timerShip(ev.scene, t);
    const w = about ? watched(ev).find((x) => x.scene === about) : undefined;
    fireRules(sim, memOf(ev), rules, w ? { ship: w } : null, (rule) => rule.on === 'timer' && rule.timer === t.id);
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
    fireRules(sim, memOf(ev), rules, { ship: w }, (rule) => stanceOk(rule, w));
    const facts = leaveFacts(ev, w);
    fireRules(sim, memOf(ev), atLeave, { ship: w }, (rule) => facts.has(rule.on) && stanceOk(rule, w));
  }
  for (const d of ev.scene.derelicts) {
    if (d.ship === undefined || !sim.world.has(d.ship, ShipC)) continue;
    fireRules(sim, memOf(ev), rules, { derelict: d }, (rule) => derelictOk(rule));
  }
  for (const p of ev.scene.pods ?? []) if (podAdrift(sim, p)) fireRules(sim, memOf(ev), rules, { pod: p }, (rule) => podOk(rule));
}
