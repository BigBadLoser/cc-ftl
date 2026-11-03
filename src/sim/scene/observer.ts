import { ShipC } from '../combat/components';
import { playerCrewOn } from '../away/crew';
import type { Sim } from '../sim';
import { applyEffect } from '../story/effects';
import type { EventEffect } from '../story/defs';
import { repKey } from '../galaxy/standing';
import type { Contact, EventGrid } from '../galaxy/types';
import type { SceneFact, SceneRuleDef, Stance } from './types';

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
}

function watched(ev: EventGrid): Watched[] {
  const out: Watched[] = ev.scene.ships.map((s) => ({ contact: s.contact, stance: s.stance }));
  const stance = ev.scene.fleet?.stance ?? 'hostile';
  for (const c of ev.fleet?.ships ?? []) out.push({ contact: c, stance });
  return out;
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
  if (playerCrewOn(sim, id)) out.add('boarded');
  if (ship.state === 'prize') out.add('captured');
  if (ship.state === 'wreck') out.add('destroyed');
  if (ship.state === 'fled') out.add('fled');
  return out;
}

/** A rule's effects with 'owner' standing resolved to the ship owner's reputation key. */
const effectsFor = (sim: Sim, rule: SceneRuleDef, owner: string): EventEffect[] =>
  (rule.effects ?? []).map((e) => (e.type === 'reputation' && e.faction === 'owner' ? { ...e, faction: repKey(sim, owner) } : e));

function fire(sim: Sim, ev: EventGrid, id: string, rule: SceneRuleDef, w: Watched | null): void {
  const key = w ? `${id}#${w.contact.id}` : id;
  if (ev.watch.fired.includes(key)) return;
  ev.watch.fired.push(key);
  const ctx = { event: ev.scene.event ?? ev.scene.key, actor: null };
  for (const eff of effectsFor(sim, rule, w?.contact.faction ?? '')) applyEffect(sim, eff, ctx);
  const name = w ? (w.contact.ship !== undefined ? sim.world.get(w.contact.ship, ShipC)?.name : undefined) ?? w.contact.name ?? 'the ship' : '';
  const text = (rule.log ?? '').replace('{ship}', name);
  sim.events.emit({ type: 'scene.observed', rule: id, ship: w?.contact.ship ?? 0, text, tone: rule.tone ?? 'info' });
}

const stanceOk = (rule: SceneRuleDef, w: Watched): boolean => !rule.stance || rule.stance.includes(w.stance);

/** Once a second in the event grid: fire the rules whose facts are now true. */
export function observeScene(sim: Sim, ev: EventGrid): void {
  const rules = rulesFor(sim, ev);
  if (!rules.length) return;
  for (const w of watched(ev)) {
    const facts = factsOf(sim, ev, w);
    for (const [id, rule] of rules) if (rule.on !== 'timer' && rule.on !== 'left' && facts.has(rule.on) && stanceOk(rule, w)) fire(sim, ev, id, rule, w);
  }
  for (const t of ev.scene.timers) {
    if (t.at === undefined || sim.tick < t.at) continue;
    for (const [id, rule] of rules) if (rule.on === 'timer' && rule.timer === t.id) fire(sim, ev, id, rule, null);
  }
}

/** On leaving the grid: a last look, then the `left` rules for every ship still in play there. */
export function observeLeave(sim: Sim, ev: EventGrid): void {
  observeScene(sim, ev);
  for (const w of watched(ev)) {
    const s = w.contact.ship === undefined ? undefined : sim.world.get(w.contact.ship, ShipC);
    if (!s || (s.state !== 'active' && s.state !== 'disabled')) continue;
    for (const [id, rule] of rulesFor(sim, ev)) if (rule.on === 'left' && stanceOk(rule, w)) fire(sim, ev, id, rule, w);
  }
}
