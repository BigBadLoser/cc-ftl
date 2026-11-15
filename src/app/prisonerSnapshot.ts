import { CrewC, PositionC, ShipC, type Sim } from '../sim';
import { heldPrisoners, prisonerOffer, stationWants } from '../sim/capture/offers';
import { PrisonerC } from '../sim/fight/components';
import { tierOf } from '../sim/galaxy/standing';
import { shipIdOf } from '../sim/regions';
import { slabPlace } from '../sim/stasis/query';
import { moduleNameOf } from '../sim/upgrades/stats';
import { TraderC } from '../sim/trade/types';
import type { UiPrisonerDeal } from '../ui/api';

const DEAL: Record<string, string> = { ransom: 'Ransom', bounty: 'Bounty', market: 'Sell' };

/** Why a station makes no deal for a prisoner now, as the row's one dim line: where to take them, or what has to happen first. */
const WHY: Record<string, string> = {
  noBounty: 'Bounty at navy or corp stations',
  notSealed: 'Seal them in stasis first',
  inTransit: 'On the way: wait until the slab is set down',
  notAboard: 'Bring them to your ship first',
  busy: 'No shuttle free just now',
  noWay: 'No shuttle can come: a working airlock and a shuttle are needed',
};

const factionName = (sim: Sim, id: string | undefined): string => (id ? sim.content.galaxy?.factions[id]?.name ?? id : 'Unknown');

/** Where a prisoner is held, as the row says it: the wheel slot, the floor, a cart or a shuttle, and the prize's name when on one. */
function whereOf(sim: Sim, id: number): string {
  const place = slabPlace(sim, id);
  const pos = sim.world.get(id, PositionC);
  const ship = place ? place.ship : pos ? shipIdOf(sim, pos) : 0;
  const s = sim.world.get(ship, ShipC);
  const prize = s?.state === 'prize' ? `Prize "${s.name}", ` : '';
  if (!place) return `${prize}not sealed`;
  if (place.kind === 'wheel') return `${prize}${moduleNameOf(sim, place.wheel)}, slot ${place.slot + 1}`;
  if (place.kind === 'carried') return `${prize}on a hover cart`;
  if (place.kind === 'shuttle') return 'in a shuttle';
  return `${prize}floor`;
}

/** Every prisoner the player holds and what the station `station` offers for each (capture/offers.ts), for the channel's Prisoners service. */
export function prisonerDeals(sim: Sim, station: number): UiPrisonerDeal[] {
  return heldPrisoners(sim).map((id) => {
    const from = sim.world.get(id, PrisonerC)?.from;
    const o = prisonerOffer(sim, station, id);
    const base = { id, name: sim.world.get(id, CrewC)?.name ?? 'Prisoner', faction: factionName(sim, from), tier: from ? tierOf(sim, from) : 'neutral' as const, frozen: !!slabPlace(sim, id), where: whereOf(sim, id) };
    const wanted = stationWants(sim, station, id);
    if (o.ok) return { ...base, wanted, offer: { ok: true, label: `${DEAL[o.kind]} ₵${o.credits}`, note: `+${o.standing} ${factionName(sim, o.faction)}` } };
    if (o.run) {
      const to = o.run.station === station ? '' : ` (to ${sim.world.get(o.run.station, TraderC)?.name ?? 'another station'})`;
      const status = o.run.stage === 'collecting' ? `Collecting…${to}` : `On the way to the station${to}`;
      return { ...base, wanted, offer: { ok: false, label: '', note: `${DEAL[o.kind ?? 'ransom']} ₵${o.credits ?? 0}`, status, ...(o.run.cancel ? { cancel: o.run.deal } : {}) } };
    }
    // No deal: no button, one line. A deal waiting on where they are names its price ("... (ransom ₵240 here)").
    const later = o.kind && o.credits !== undefined ? ` (${DEAL[o.kind]?.toLowerCase()} ₵${o.credits} here)` : '';
    const note = o.reason === 'noBuyer' ? `Ransom at ${factionName(sim, from)} stations` : `${WHY[o.reason] ?? o.reason}${later}`;
    return { ...base, wanted, offer: { ok: false, label: '', note } };
  });
}
