import type { Sim } from '../sim';
import { unit } from './hash';
import { fleetName } from './names';
import { fleetStrength } from './encounterOdds';
import { isHostileFaction } from './standing';
import { nodeOf } from './state';
import { ENCOUNTER_COOLDOWN, ENCOUNTER_MAX, ENCOUNTER_TTL, PASSING_ENCOUNTER_CHANCE } from './tuning';
import type { CrossingHow, Encounter, EncounterKind, Fleet } from './types';

/**
 * Crossings and encounters (slice (b) of NPC traffic). Travel happens between turns: the player's hop and every fleet's step of the
 * same turn are compared when the player's hop ends (`crossAfterHop`). They cross when
 * - they pass each other on one lane, in opposite directions ('pass'), or on the same lane the same way ('overlap'), or
 * - the turn ends with both in one node ('node'; a fleet that rests at the node counts).
 * Each crossing emits `galaxy.crossing`; a hail or scan only follows with chance PASSING_ENCOUNTER_CHANCE. It decides an encounter kind from the fleet, stores it in `GalaxyState.encounters` and emits
 * `galaxy.encounter`. Only an interdiction does anything: while one is pending the player's travel halts (the trip drops at the
 * node reached, see `hyperspace.ts`) and `galaxy.jump` is refused. Slice (c) resolves encounters (evade, bribe, fight on an event
 * grid) by calling `resolveEncounter`; until then `galaxy.dismissEncounter` clears one and each expires on its own.
 */

/**
 * What a fleet wants of the player: pirates and raiders that are hostile to the player interdict; traders hail; patrols scan;
 * a damaged (stranded) fleet that is not hostile calls for help.
 */
export function encounterKind(sim: Sim, f: Fleet): EncounterKind {
  const hostile = isHostileFaction(sim, f.faction);
  if (f.damaged) return hostile ? 'hail' : 'distress';
  if ((f.role === 'pirate' || f.role === 'raider') && hostile) return 'interdict';
  if (f.role === 'patrol') return 'scan';
  return 'hail';
}

const PASSING_SALT = 0x9a55;

/** Does a non-hostile fleet crossing the player in this turn make a hail or scan? A pure function of the seed, the fleet and the turn. */
export const passingMeets = (sim: Sim, fleet: number, turn: number): boolean => unit(sim.seed, fleet, turn, PASSING_SALT) < PASSING_ENCOUNTER_CHANCE;

/** How the player's hop `from` -> `to` met the fleet in the turn, or null. */
export function crossingOf(f: Fleet, from: string, to: string, turn: number): CrossingHow | null {
  const moved = f.moved === turn && f.from !== f.node;
  if (moved && f.from === to && f.node === from) return 'pass';
  if (moved && f.from === from && f.node === to) return 'overlap';
  return f.node === to ? 'node' : null;
}

/** An interdiction is pending: the player's travel is halted. */
export const interdicted = (sim: Sim): boolean => sim.galaxy.encounters.some((e) => e.kind === 'interdict');

/**
 * The player's hop `from` -> `to` has just ended in this turn. Detect crossings with the fleets (ascending id), store and announce
 * their encounters. Returns true when an interdiction is now pending, so the caller halts the trip.
 */
export function crossAfterHop(sim: Sim, from: string, to: string): boolean {
  const g = sim.galaxy;
  let halted = false;
  for (const f of g.fleets) {
    const how = crossingOf(f, from, to, g.turn);
    if (!how) continue;
    sim.events.emit({ type: 'galaxy.crossing', fleet: f.id, faction: f.faction, role: f.role, how, node: to });
    if (f.met !== undefined && g.turn - f.met < ENCOUNTER_COOLDOWN) continue;
    const kind = encounterKind(sim, f);
    // Passing a non-hostile fleet usually means nothing: only a small chance of a hail or scan (distress and interdictions always happen).
    if ((kind === 'hail' || kind === 'scan') && !passingMeets(sim, f.id, g.turn)) continue;
    f.met = g.turn;
    const ttl = kind === 'interdict' ? ENCOUNTER_TTL.interdict : ENCOUNTER_TTL.alert;
    const e: Encounter = {
      id: g.nextFleet++, kind, fleet: f.id, faction: f.faction, role: f.role, name: fleetName(f), ships: f.ships.length, strength: fleetStrength(f.ships), danger: nodeOf(sim, to)?.danger ?? 0, how, node: to, turn: g.turn, expires: g.turn + ttl,
    };
    g.encounters.push(e);
    if (g.encounters.length > ENCOUNTER_MAX) g.encounters.splice(0, g.encounters.length - ENCOUNTER_MAX);
    sim.events.emit({ type: 'galaxy.encounter', id: e.id, kind, fleet: f.id, faction: f.faction, role: f.role, node: to });
    if (kind === 'interdict') halted = true;
  }
  if (g.encounters.length) g.rev++;
  return halted;
}

/** Drop alerts whose time ran out (an interdiction stays until it is resolved). */
export function expireEncounters(sim: Sim, turn: number): void {
  const g = sim.galaxy;
  const gone = (e: Encounter): boolean => e.kind !== 'interdict' && e.expires <= turn;
  const left = g.encounters.filter((e) => !gone(e));
  if (left.length === g.encounters.length) return;
  for (const e of g.encounters) if (gone(e)) sim.events.emit({ type: 'galaxy.encounterResolved', id: e.id, outcome: 'expired' });
  g.encounters = left;
  g.rev++;
}

/** End an encounter with an outcome ('evaded', 'bribed', 'fought', 'acknowledged', ...). False when there is no such encounter. */
export function finishEncounter(sim: Sim, id: number, outcome: string, detail: { odds?: number; roll?: number; cost?: number } = {}): boolean {
  const g = sim.galaxy;
  const e = g.encounters.find((x) => x.id === id);
  if (!e) return false;
  g.lastResult = { id, kind: e.kind, faction: e.faction, role: e.role, outcome, turn: g.turn, ...detail };
  g.encounters = g.encounters.filter((e) => e.id !== id);
  g.rev++;
  sim.events.emit({ type: 'galaxy.encounterResolved', id, outcome });
  return true;
}
