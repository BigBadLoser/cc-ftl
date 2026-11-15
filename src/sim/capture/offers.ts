import { ShipC } from '../combat/components';
import { CrewC, PositionC } from '../crew/components';
import { PrisonerC } from '../fight/components';
import { setsOf } from '../blackmarket/services';
import type { SkillName } from '../registry';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { slabPlace } from '../stasis/query';
import { playerShips, skillOf } from '../story/world';
import { TraderC } from '../trade/types';
import { playerShip } from '../trade/player';
import { slabRoute, startSlabRun } from '../galaxy/handover';
import { prisonerRun } from './delivery';
import { PRISONER_DEALS, type PrisonerDealKind } from './tuning';

/**
 * Cashing in prisoners at a station (#116, DESIGN.md "Prisoners and prizes"): what a station offers for a prisoner (`prisonerOffer`, the one owner the
 * UI and the hand-over both ask) and the hand-over itself (`handOverPrisoner`, command 'prisoner.handOver').
 *  - ransom: a station of the prisoner's own faction (`Prisoner.from`) buys them back;
 *  - bounty: a navy or corporate station pays for a pirate;
 *  - black market: a station carrying a black-market set takes anyone, for the set's owner (else the station's) standing.
 * The prisoner goes as the sealed slab, from a wheel or the floor of the player's ship, by shuttle (capture/delivery.ts): the station keeps the slab.
 */

export type PrisonerOffer =
  | { ok: true; kind: PrisonerDealKind; credits: number; faction: string; standing: number }
  /**
   * Why not: 'notStation' (no trading station), 'noBuyer' (no deal for them here), 'noBounty' (a pirate at a station that pays no bounty),
   * 'notSealed' (only a sealed slab is handed over), 'inTransit' (the slab is on a cart or in a shuttle), 'notAboard' (on a prize, or another ship:
   * bring them to the ship with the airlock), 'busy' (a fight, or the airlock or the shuttle is busy: soon), 'noWay' (no shuttle can come for the slab:
   * capture/delivery.ts), 'underWay' (a handover run has them: `run`, to this station or another).
   * `kind` and `credits` are the deal the station would make once they are aboard and sealed, when there is one.
   */
  | {
    ok: false; reason: 'notStation' | 'noBuyer' | 'noBounty' | 'notSealed' | 'inTransit' | 'notAboard' | 'notPrisoner' | 'busy' | 'noWay' | 'underWay';
    kind?: PrisonerDealKind; credits?: number;
    /** 'underWay': the run (its deal id, the station it goes to), 'collecting' until the slab leaves the ship, then 'toStation'; `cancel` while it can be called off. */
    run?: { deal: number; station: number; stage: 'collecting' | 'toStation'; cancel: boolean };
  };

const SKILLS: SkillName[] = ['gunnery', 'piloting', 'shielding', 'melee', 'construction', 'hacking', 'medicine', 'science', 'cooking', 'botany', 'industry'];

/** A prisoner's worth to a buyer: their best skill level (a captain or a gunner is worth more than a deckhand). */
export function prisonerWorth(sim: Sim, prisoner: number): number {
  return Math.max(0, ...SKILLS.map((s) => skillOf(sim, prisoner, s)));
}

/** The deal a station would make for a prisoner, before where they are is looked at, or the reason it makes none. */
function dealFor(sim: Sim, station: number, prisoner: number): { kind: PrisonerDealKind; faction: string } | 'noBuyer' | 'noBounty' {
  const t = sim.world.get(station, TraderC)!;
  const from = sim.world.get(prisoner, PrisonerC)?.from;
  const factions = sim.content.galaxy?.factions ?? {};
  if (from && t.owner === from) return { kind: 'ransom', faction: from };
  const pirate = !!from && factions[from]?.kind === 'pirates';
  const lawful = !!t.owner && (factions[t.owner]?.kind === 'government' || factions[t.owner]?.kind === 'corporation');
  if (pirate && lawful) return { kind: 'bounty', faction: t.owner! };
  const market = setsOf(sim, t)[0];
  if (market) {
    const faction = market.owner ?? t.owner;
    if (faction) return { kind: 'market', faction };
  }
  return pirate ? 'noBounty' : 'noBuyer';
}

/** Where the prisoner is held for a hand-over: ok, or why they cannot be handed over from there. */
function heldFor(sim: Sim, prisoner: number): 'ok' | 'notSealed' | 'inTransit' | 'notAboard' {
  const place = slabPlace(sim, prisoner);
  const pos = sim.world.get(prisoner, PositionC);
  const ship = place ? place.ship : pos ? shipIdOf(sim, pos) : 0;
  if (!ship || !playerShips(sim).has(ship) || sim.world.get(ship, ShipC)?.state === 'prize') return place?.kind === 'shuttle' ? 'inTransit' : 'notAboard';
  if (ship !== playerShip(sim)) return 'notAboard'; // the shuttle comes to the main ship's airlock
  if (!place) return 'notSealed';
  return place.kind === 'carried' || place.kind === 'shuttle' ? 'inTransit' : 'ok';
}

/** What `station` offers for `prisoner` now: the deal (credits, the faction whose standing it moves, by how much), or why there is none. */
export function prisonerOffer(sim: Sim, station: number, prisoner: number): PrisonerOffer {
  if (!sim.world.has(prisoner, PrisonerC) || !sim.world.has(prisoner, CrewC)) return { ok: false, reason: 'notPrisoner' };
  const run = prisonerRun(sim, prisoner);
  if (run?.handover?.prisoner) {
    const out = run.phase === 'out' || run.phase === 'exchange';
    const { kind, credits } = run.handover.prisoner;
    return { ok: false, reason: 'underWay', kind, credits, run: { deal: run.id, station: run.ship, stage: out ? 'toStation' : 'collecting', cancel: !out } };
  }
  if (!sim.world.get(station, TraderC)?.station) return { ok: false, reason: 'notStation' };
  const deal = dealFor(sim, station, prisoner);
  if (typeof deal === 'string') return { ok: false, reason: deal };
  const tune = PRISONER_DEALS[deal.kind];
  const credits = tune.base + tune.perLevel * prisonerWorth(sim, prisoner);
  const held = heldFor(sim, prisoner);
  if (held !== 'ok') return { ok: false, reason: held, kind: deal.kind, credits };
  const way = slabRoute(sim, station);
  if (way !== 'ok') return { ok: false, reason: way, kind: deal.kind, credits };
  return { ok: true, kind: deal.kind, credits, faction: deal.faction, standing: tune.standing };
}

/**
 * Whether `station` has a deal for `prisoner` at all: one it makes now, one it would make once they are sealed and aboard, or one under way with it.
 * The station's Prisoners service shows only while this holds for a prisoner the player holds.
 */
export function stationWants(sim: Sim, station: number, prisoner: number): boolean {
  const o = prisonerOffer(sim, station, prisoner);
  return o.ok || (o.kind !== undefined && (!o.run || o.run.station === station));
}

/** Every prisoner the player holds, frozen or not, on any of their ships or prizes (or in a shuttle's rack), ascending ids. */
export function heldPrisoners(sim: Sim): number[] {
  const ships = playerShips(sim);
  return [...sim.world.query(PrisonerC, CrewC)].filter((id) => {
    const place = slabPlace(sim, id);
    const pos = sim.world.get(id, PositionC);
    return place ? place.kind === 'shuttle' || ships.has(place.ship) : !!pos && ships.has(shipIdOf(sim, pos));
  }).sort((a, b) => a - b);
}

/**
 * Accept a station's offer for a prisoner (command 'prisoner.handOver'): a shuttle is sent for the sealed slab on the terms offered now (galaxy/handover.ts
 * runs it, capture/delivery.ts moves the slab), and the prisoner is paid for once the slab reaches the station. A reject reason, or null.
 */
export function handOverPrisoner(sim: Sim, prisoner: number, station: number): string | null {
  const offer = prisonerOffer(sim, station, prisoner);
  if (!offer.ok) return offer.reason;
  const name = sim.world.get(prisoner, CrewC)?.name ?? 'Prisoner';
  const run = startSlabRun(sim, station, { crew: prisoner, name, kind: offer.kind, credits: offer.credits, faction: offer.faction, standing: offer.standing });
  if (!run) return 'busy';
  sim.events.emit({ type: 'prisoner.collecting', crew: prisoner, name, station, via: run.handover?.via ?? 'station' });
  return null;
}
