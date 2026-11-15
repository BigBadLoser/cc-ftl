import { ShipC } from '../combat/components';
import { CrewC, PositionC } from '../crew/components';
import { removeCrew } from '../crew/depart';
import { PrisonerC } from '../fight/components';
import { repKey } from '../galaxy/standing';
import { setsOf } from '../blackmarket/services';
import type { SkillName } from '../registry';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { openSlab } from '../stasis/freeze';
import { slabPlace } from '../stasis/query';
import { applyEffect } from '../story/effects';
import { playerShips, skillOf } from '../story/world';
import { addCredits } from '../trade/credits';
import { TraderC } from '../trade/types';
import { PRISONER_DEALS, type PrisonerDealKind } from './tuning';

/**
 * Cashing in prisoners at a station (#116, DESIGN.md "Prisoners and prizes"): what a station offers for a prisoner (`prisonerOffer`, the one owner the
 * UI and the hand-over both ask) and the hand-over itself (`handOverPrisoner`, command 'prisoner.handOver').
 *  - ransom: a station of the prisoner's own faction (`Prisoner.from`) buys them back;
 *  - bounty: a navy or corporate station pays for a pirate;
 *  - black market: a station carrying a black-market set takes anyone, for the set's owner (else the station's) standing.
 * The prisoner goes as a sealed slab standing in a wheel or lying on the floor of one of the player's ships that is not a prize; the slab is opened
 * at the hand-over and the empty one stays where it was.
 */

export type PrisonerOffer =
  | { ok: true; kind: PrisonerDealKind; credits: number; faction: string; standing: number }
  /**
   * Why not: 'notStation' (no trading station), 'noBuyer' (no deal for them here), 'noBounty' (a pirate at a station that pays no bounty),
   * 'notSealed' (only a sealed slab is handed over), 'inTransit' (the slab is on a cart or in a shuttle), 'notAboard' (on a prize: bring them home).
   * `kind` and `credits` are the deal the station would make once they are aboard and sealed, when there is one.
   */
  | { ok: false; reason: 'notStation' | 'noBuyer' | 'noBounty' | 'notSealed' | 'inTransit' | 'notAboard' | 'notPrisoner'; kind?: PrisonerDealKind; credits?: number };

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
  if (!place) return 'notSealed';
  return place.kind === 'carried' || place.kind === 'shuttle' ? 'inTransit' : 'ok';
}

/** What `station` offers for `prisoner` now: the deal (credits, the faction whose standing it moves, by how much), or why there is none. */
export function prisonerOffer(sim: Sim, station: number, prisoner: number): PrisonerOffer {
  if (!sim.world.has(prisoner, PrisonerC) || !sim.world.has(prisoner, CrewC)) return { ok: false, reason: 'notPrisoner' };
  if (!sim.world.get(station, TraderC)?.station) return { ok: false, reason: 'notStation' };
  const deal = dealFor(sim, station, prisoner);
  if (typeof deal === 'string') return { ok: false, reason: deal };
  const tune = PRISONER_DEALS[deal.kind];
  const credits = tune.base + tune.perLevel * prisonerWorth(sim, prisoner);
  const held = heldFor(sim, prisoner);
  if (held !== 'ok') return { ok: false, reason: held, kind: deal.kind, credits };
  return { ok: true, kind: deal.kind, credits, faction: deal.faction, standing: tune.standing };
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
 * Hand a prisoner over to a station for its offer (command 'prisoner.handOver'): the credits are paid, the standing moves (through the shared
 * reputation effect, so the log names it), the slab is opened (the empty slab stays in its wheel slot or on the floor) and the prisoner leaves.
 * A reject reason, or null.
 */
export function handOverPrisoner(sim: Sim, prisoner: number, station: number): string | null {
  const offer = prisonerOffer(sim, station, prisoner);
  if (!offer.ok) return offer.reason;
  const name = sim.world.get(prisoner, CrewC)?.name ?? 'Prisoner';
  addCredits(sim, offer.credits);
  applyEffect(sim, { type: 'reputation', faction: repKey(sim, offer.faction), delta: offer.standing }, { event: 'prisoner', actor: null });
  openSlab(sim, prisoner);
  removeCrew(sim, prisoner);
  sim.events.emit({ type: 'prisoner.handedOver', crew: prisoner, name, station, kind: offer.kind, credits: offer.credits, faction: offer.faction });
  return null;
}
