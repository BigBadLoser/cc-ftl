import type { Sim } from '../sim';
import { settleScan } from '../blackmarket/scan';
import { headHome } from './agenda';
import { bribeCost, evadeOdds } from './encounterOdds';
import { finishEncounter } from './encounters';
import { enterEvent, inEvent, leaveEvent } from './eventGrid';
import { unit } from './hash';
import { resumeAfterHop } from './hyperspace';
import type { Encounter, EncounterChoice } from './types';

/**
 * `galaxy.respond { encounter, choice }`: the player answers a pending encounter.
 * - interdiction: 'evade' (a roll, `evadeOdds`; seeded by the world seed and the encounter id, so a run and a reload agree; failure drops into the fight),
 *   'bribe' (`bribeCost` credits, refused without them; the fleet then leaves you alone for its cooldown) or 'fight' (the event grid opens).
 *   Success lets the halted trip carry on.
 * - distress: 'respond' (an event grid with the damaged fleet's ships as neutral ships; leaving it carries the trip on) or 'ignore'.
 * - hail / scan: 'acknowledge' (or 'ignore'). A scan that found contraband (`Encounter.scan`, blackmarket/scan.ts) takes 'surrender' or 'bribe' instead.
 */
const EVADE_SALT = 0xe7ad;

/** The choices an encounter offers. */
export const choicesOf = (e: Encounter): EncounterChoice[] =>
  e.kind === 'interdict' ? ['evade', 'bribe', 'fight'] : e.kind === 'distress' ? ['respond', 'ignore'] : e.scan ? ['surrender', 'bribe'] : ['acknowledge'];

/** The evade roll for an encounter: a pure function of the seed and the id. */
export const evadeRoll = (sim: Sim, e: Encounter): number => unit(sim.seed, e.id, EVADE_SALT);

/** Let the interdicted trip go on (the encounter is already settled), unless another interdiction is still waiting for an answer. */
function resume(sim: Sim): void {
  const t = sim.galaxy.travel;
  if (sim.galaxy.encounters.some((e) => e.kind === 'interdict')) return;
  if (t?.phase === 'interdicted') resumeAfterHop(sim, t);
}

/** Start the fight; if the fleet is gone the interdiction just dissolves. */
function fight(sim: Sim, e: Encounter, outcome: string, detail: { odds?: number; roll?: number } = {}): boolean {
  if (!sim.galaxy.fleets.some((f) => f.id === e.fleet)) {
    finishEncounter(sim, e.id, 'gone');
    resume(sim);
    return true;
  }
  finishEncounter(sim, e.id, outcome, detail);
  return enterEvent(sim, e, 'fight');
}

export function respond(sim: Sim, id: number, choice: EncounterChoice, command = 'galaxy.respond'): boolean {
  const g = sim.galaxy;
  const reject = (reason: string): false => (sim.events.emit({ type: 'command.rejected', command, reason }), false);
  const e = g.encounters.find((x) => x.id === id);
  if (!e) return reject('noEncounter');
  if (!choicesOf(e).includes(choice)) return reject('badChoice');
  if (inEvent(sim)) return reject('inEvent');
  const t = g.travel;
  const waiting = sim.sector.state === 'hyperspace' && !!t;
  if (e.kind === 'interdict' && !(waiting && t?.phase === 'interdicted')) return reject('notInterdicted');
  if (e.scan && (choice === 'surrender' || choice === 'bribe')) {
    const r = settleScan(sim, e, choice);
    if (r === 'cantAfford') return reject('cantAfford');
    finishEncounter(sim, id, r.outcome, { cost: r.cost });
    return true;
  }
  if (choice === 'bribe') {
    const cost = bribeCost(sim, e);
    if (sim.trade.credits < cost) return reject('cantAfford');
    sim.trade.credits -= cost;
    const f = g.fleets.find((x) => x.id === e.fleet);
    if (f) f.met = g.turn;
    // A bought-off hunter calls off the hunt.
    if (f?.hunt) {
      delete f.hunt;
      f.standDown = true;
      headHome(sim, f);
    }
    sim.events.emit({ type: 'galaxy.bribed', id, cost, faction: e.faction });
    finishEncounter(sim, id, 'bribed', { cost });
    resume(sim);
    return true;
  }
  if (choice === 'evade') {
    const odds = evadeOdds(sim, e);
    const roll = evadeRoll(sim, e);
    const success = roll < odds;
    sim.events.emit({ type: 'galaxy.evadeRoll', id, odds, roll: Math.round(roll * 1000) / 1000, success });
    if (!success) return fight(sim, e, 'evadeFailed', { odds, roll });
    finishEncounter(sim, id, 'evaded', { odds, roll });
    resume(sim);
    return true;
  }
  if (choice === 'fight') return fight(sim, e, 'fought');
  if (choice === 'respond') {
    if (!waiting || t?.phase === 'event') return reject('notInHyperspace');
    if (!g.fleets.some((f) => f.id === e.fleet)) return reject('fleetGone');
    finishEncounter(sim, id, 'responded');
    return enterEvent(sim, e, 'rescue');
  }
  finishEncounter(sim, id, choice === 'acknowledge' ? 'acknowledged' : 'ignored');
  return true;
}

/** `galaxy.leaveEvent`: leave the event grid and carry on with the trip. */
export const leave = (sim: Sim, command?: string): boolean => leaveEvent(sim, resume, command);
