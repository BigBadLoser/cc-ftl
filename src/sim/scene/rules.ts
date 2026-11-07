import { ShipC } from '../combat/components';
import { CrewC } from '../crew/components';
import { repKey } from '../galaxy/standing';
import type { Contact } from '../galaxy/types';
import type { Sim } from '../sim';
import type { EventEffect } from '../story/defs';
import { applyEffect } from '../story/effects';
import type { Ambush, SceneDerelict, ScenePod, SceneRuleDef, SceneShip, Stance } from './types';

/**
 * Firing an event's observer rules (DESIGN.md "Physical encounters", part c). The pocket observer (observer.ts) fires them about what is in the pocket
 * while it is open; a person the scene handed on (a passenger the player took in, scene/carried.ts) carries the event's rules with them after the pocket is
 * gone. Either way a rule fires once per subject: its effects apply and its log line goes out as `scene.observed`.
 */

/** A scene ship the observer watches: its descriptor and its stance (a fleet's ships all take the fleet's). */
export interface Watched {
  contact: Contact;
  stance: Stance;
  ambush?: Ambush;
  /** The scene ship itself (a fleet's ships have none). */
  scene?: SceneShip;
}

/** A person a scene handed on: who, the galaxy faction they are from (an 'owner' standing lands there) and the credits they carry. */
export interface Person {
  crew: number;
  origin: string;
  purse: number;
}

/** What a rule fires about: a scene ship, a derelict, a crew member lost, an escape pod's patient, a person carried on, or nothing (a timer). */
export type Subject = { ship: Watched } | { derelict: SceneDerelict } | { crew: number } | { pod: ScenePod } | { person: Person } | null;

/** Where rule firings are remembered: the event the rules are of, and the keys fired so far (an open scene's watch, a carried person's grant). */
export interface RuleMemory {
  event: string;
  fired: string[];
}

/** The rules in force for an event: the shared ones, with the encounter's own added or overriding them (null switches one off). Sorted by id. */
export function rulesOf(sim: Sim, event: string | undefined): [string, SceneRuleDef][] {
  const own = event ? sim.content.events?.[event]?.scene?.rules : undefined;
  const all: Record<string, SceneRuleDef | null> = { ...(sim.content.sceneRules ?? {}), ...(own ?? {}) };
  return Object.entries(all).filter((e): e is [string, SceneRuleDef] => e[1] !== null).sort(([a], [b]) => (a < b ? -1 : 1));
}

function keyOf(id: string, s: Subject): string {
  if (!s) return id;
  if ('ship' in s) return `${id}#${s.ship.contact.id}`;
  if ('derelict' in s) return `${id}#d${s.derelict.id}`;
  if ('pod' in s) return `${id}#p${s.pod.id}`;
  if ('person' in s) return `${id}#n${s.person.crew}`;
  return `${id}#c${s.crew}`;
}

/** The galaxy faction an 'owner' standing of the subject lands on. */
const ownerOf = (s: Subject): string => (!s ? '' : 'ship' in s ? s.ship.contact.faction : 'pod' in s ? s.pod.owner : 'person' in s ? s.person.origin : '');

/** A rule's effects with 'owner' standing resolved to the subject owner's reputation key. */
const effectsFor = (sim: Sim, rule: SceneRuleDef, owner: string): EventEffect[] =>
  (rule.effects ?? []).map((e) => (e.type === 'reputation' && e.faction === 'owner' ? { ...e, faction: repKey(sim, owner) } : e));

function fire(sim: Sim, mem: RuleMemory, id: string, rule: SceneRuleDef, s: Subject): void {
  const key = keyOf(id, s);
  if (mem.fired.includes(key)) return;
  mem.fired.push(key);
  const ctx = {
    event: mem.event, actor: null,
    ...(s && 'ship' in s && s.ship.contact.ship !== undefined ? { ship: s.ship.contact.ship } : {}),
    ...(s && 'person' in s ? { purse: s.person.purse } : {}),
  };
  for (const eff of effectsFor(sim, rule, ownerOf(s))) applyEffect(sim, eff, ctx);
  const shipId = !s ? 0 : 'ship' in s ? s.ship.contact.ship ?? 0 : 'derelict' in s ? s.derelict.ship ?? 0 : 0;
  const live = shipId && sim.world.has(shipId, ShipC) ? sim.world.get(shipId, ShipC)?.name : undefined;
  const name = !s ? '' : 'ship' in s ? live ?? s.ship.contact.name ?? 'the ship' : 'derelict' in s ? live ?? s.derelict.name : '';
  const crew = !s ? '' : 'crew' in s ? sim.world.get(s.crew, CrewC)?.name ?? 'A crew member'
    : 'pod' in s ? s.pod.patient.name : 'person' in s ? sim.world.get(s.person.crew, CrewC)?.name ?? 'A passenger' : '';
  const text = (rule.log ?? '').replace('{ship}', name).replace('{crew}', crew);
  sim.events.emit({ type: 'scene.observed', rule: id, ship: shipId && sim.world.has(shipId, ShipC) ? shipId : 0, text, tone: rule.tone ?? 'info' });
}

/** Fire, about one subject, each of `rules` that `when` accepts and that has not fired about it yet (remembered in `mem`). */
export function fireRules(sim: Sim, mem: RuleMemory, rules: readonly [string, SceneRuleDef][], s: Subject, when: (rule: SceneRuleDef) => boolean): void {
  for (const [id, rule] of rules) if (when(rule)) fire(sim, mem, id, rule, s);
}
