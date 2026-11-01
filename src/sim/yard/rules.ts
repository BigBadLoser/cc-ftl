import { ShipC } from '../combat/components';
import { nodeOf } from '../galaxy/state';
import type { Sim } from '../sim';
import { hailVerdict } from '../trade/traders';
import { TraderC } from '../trade/types';
import type { YardMoney, YardSizeDef } from './types';

/** A station's shipyard: the tier it runs at and the multiplier its prices carry. */
export interface YardService {
  station: number;
  /** The generator kind and size of the station ('station.trading', 'hub'). */
  kind: string;
  size: string;
  tier: YardSizeDef;
  /** The node's danger tier. */
  danger: number;
  /** Price multiplier: the tier's, times the danger markup. */
  mult: number;
}

/**
 * The shipyard a station offers, or null. Trading and military stations of the station and hub tiers run one (`YardDef.kinds` / `sizes`); outposts
 * and research, farming, mining and pirate stations do not. A station that is silent or hostile to the player, or not in play does not deal.
 */
export function yardService(sim: Sim, station: number): YardService | null {
  const def = sim.content.yard;
  const ship = sim.world.get(station, ShipC);
  if (!def || !ship?.gen || !ship.immobile) return null;
  if (ship.faction === 'player' || ship.state !== 'active' || !sim.world.has(station, TraderC)) return null;
  const size = ship.gen.role ?? '';
  const tier = def.sizes[size];
  if (!def.kinds.includes(ship.gen.faction) || !tier || !hailVerdict(sim, station).answers) return null;
  const danger = nodeOf(sim, sim.galaxy.current)?.danger ?? 0;
  return { station, kind: ship.gen.faction, size, tier, danger, mult: tier.price * (1 + def.dangerStep * danger) };
}

/** The price of `n` painted tiles at a yard: credits and metal, rounded up so a small job never costs nothing. */
export function yardPrice(sim: Sim, svc: YardService, n: number): YardMoney {
  const per = sim.content.yard?.perTile ?? { credits: 0, metal: 0 };
  return { credits: Math.ceil(n * per.credits * svc.mult), metal: Math.ceil(n * per.metal * svc.mult) };
}
