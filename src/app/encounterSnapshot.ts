import {
  bribeCost, contrabandAboard, choicesOf, evadeOdds, galaxyIndex, hostilesPresent, isHostileFaction, leaveBlocker, type Encounter, type Sim,
} from '../sim';
import type { UiEncounter, UiEncounterChoice, UiEncounterResult, UiEventGrid } from '../ui/starmapApi';
import { toneOf } from './starmapTone';

export const ROLE_LABEL: Record<string, string> = { trader: 'Trader', miner: 'Miner', patrol: 'Patrol', pirate: 'Pirate', raider: 'Raider' };
const TITLE = { interdict: 'Interdiction', hail: 'Hail', scan: 'Patrol scan', distress: 'Distress call' } as const;
const titleOf = (e: Encounter): string => (e.kind === 'scan' && e.fleet === 0 ? 'Dock scan' : TITLE[e.kind]);
const HOW = { pass: 'Met you on the lane', overlap: 'Caught up with you on the lane', node: 'Waiting where you came out' } as const;

const threatOf = (strength: number): string => (strength < 2.5 ? 'Light' : strength < 5 ? 'Moderate' : strength < 9 ? 'Heavy' : 'Overwhelming');
const nodeName = (sim: Sim, id: string): string => (sim.galaxy.discovered[id] !== undefined ? galaxyIndex(sim.galaxy).nodes.get(id)?.name : undefined) ?? 'uncharted space';
const factionName = (sim: Sim, id: string): string => sim.content.galaxy?.factions[id]?.name ?? id;

const LABEL: Record<UiEncounterChoice['choice'], string> = {
  evade: 'Evade', bribe: 'Bribe', fight: 'Fight', respond: 'Respond', ignore: 'Ignore', acknowledge: 'Acknowledge', surrender: 'Surrender goods',
};

function choicesFor(sim: Sim, e: Encounter): UiEncounterChoice[] {
  const waiting = sim.sector.state === 'hyperspace' && !!sim.galaxy.travel;
  return choicesOf(e).map((choice) => {
    const base = { choice, label: LABEL[choice], detail: '', enabled: true, why: null as string | null };
    if (choice === 'evade') return { ...base, detail: `${Math.round(evadeOdds(sim, e) * 100)}%` };
    if (choice === 'surrender' && e.scan) return { ...base, detail: `lose goods, ${e.scan.fine} cr fine, standing lost` };
    if (choice === 'bribe' && e.scan) {
      const short = sim.trade.credits < e.scan.bribe;
      return { ...base, detail: `${e.scan.bribe} cr`, enabled: !short, why: short ? `Need ${e.scan.bribe} credits` : null };
    }
    if (choice === 'bribe') {
      const cost = bribeCost(sim, e);
      const short = sim.trade.credits < cost;
      return { ...base, detail: `${cost} cr`, enabled: !short, why: short ? `Need ${cost} credits` : null };
    }
    if (choice === 'fight') return { ...base, detail: 'Combat' };
    if (choice === 'respond') {
      const here = sim.galaxy.fleets.some((f) => f.id === e.fleet);
      return { ...base, detail: 'Help them', enabled: waiting && here, why: !here ? 'They are gone' : waiting ? null : 'Only in hyperspace' };
    }
    return base;
  });
}

/** The pending encounters as cards. */
export function encountersOf(sim: Sim): UiEncounter[] {
  return sim.galaxy.encounters.map((e) => ({
    id: e.id, kind: e.kind, title: titleOf(e), name: e.name, faction: factionName(sim, e.faction), role: e.fleet === 0 ? 'Station' : ROLE_LABEL[e.role] ?? e.role,
    tone: toneOf(sim.content.galaxy?.factions[e.faction]?.kind), hostile: isHostileFaction(sim, e.faction), ships: e.ships, threat: threatOf(e.strength),
    how: e.fleet === 0 ? 'Scanned as you open trade' : HOW[e.how], node: nodeName(sim, e.node), choices: choicesFor(sim, e),
    ...(e.scan ? { contraband: { found: contrabandAboard(sim).map((l) => `${l.count} ${sim.content.items[l.item]?.name ?? l.item}`).join(', ') || 'contraband', value: e.scan.value, fine: e.scan.fine, bribe: e.scan.bribe } } : {}),
  }));
}

const pct = (v: number | undefined): string => `${Math.round((v ?? 0) * 100)}%`;

/** The last outcome as one line. */
export function resultOf(sim: Sim): UiEncounterResult | null {
  const r = sim.galaxy.lastResult;
  if (!r) return null;
  const who = `${factionName(sim, r.faction)} ${(ROLE_LABEL[r.role] ?? r.role).toLowerCase()}`;
  switch (r.outcome) {
    case 'evaded': return { text: `Evaded the ${who}: rolled ${pct(r.roll)} against ${pct(r.odds)}`, tone: 'green', turn: r.turn };
    case 'evadeFailed': return { text: `Evade failed against the ${who}: rolled ${pct(r.roll)} against ${pct(r.odds)}`, tone: 'red', turn: r.turn };
    case 'bribed': return { text: `Paid the ${who} ${r.cost ?? 0} credits to let you pass`, tone: 'amber', turn: r.turn };
    case 'fought': return { text: `Fighting the ${who}`, tone: 'red', turn: r.turn };
    case 'confiscated': return { text: `The ${who} confiscated your contraband and fined you ${r.cost ?? 0} credits`, tone: 'red', turn: r.turn };
    case 'cleared': return { text: `Cleared the ${who}`, tone: 'green', turn: r.turn };
    case 'escaped': return { text: `Escaped the ${who}`, tone: 'amber', turn: r.turn };
    case 'left': return { text: `Left the ${who} behind`, tone: 'dim', turn: r.turn };
    case 'helped': return { text: `Helped the ${who}`, tone: 'green', turn: r.turn };
    case 'responded': return { text: `Answering the ${who}'s distress call`, tone: 'green', turn: r.turn };
    case 'gone': return { text: `The ${who} is gone`, tone: 'dim', turn: r.turn };
    default: return null;
  }
}

/** The event grid the player is in, or null. */
export function eventOf(sim: Sim): UiEventGrid | null {
  const ev = sim.galaxy.event;
  const t = sim.galaxy.travel;
  if (!ev || !t) return null;
  const hostiles = hostilesPresent(sim);
  const blocker = leaveBlocker(sim);
  const f = ev.fleet;
  return {
    id: ev.id, kind: ev.kind, title: ev.kind === 'fight' ? 'Deep space: interdiction' : 'Deep space: distress call', faction: factionName(sim, f.faction),
    role: ROLE_LABEL[f.role] ?? f.role, tone: toneOf(sim.content.galaxy?.factions[f.faction]?.kind), ships: f.ships.length, hostiles,
    deploying: sim.sector.state === 'deploying', canLeave: blocker === null,
    why: blocker === 'notCharged' ? 'The FTL drive must be charged to flee' : blocker === 'tradeInProgress' ? 'A trade is in progress' : blocker,
    fleeing: hostiles > 0, resumeTo: nodeName(sim, t.route[t.route.length - 1] as string), hopsLeft: Math.max(0, t.route.length - 1 - t.at),
  };
}
