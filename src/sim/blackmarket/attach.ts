import { ShipC } from '../combat/components';
import type { Sim } from '../sim';
import { ensureTrader } from '../trade/traders';
import { rollFence, rollServiceStock, stationIdentity } from './services';
import { setTruce } from './truce';
import { strHash } from '../galaxy/hash';

/**
 * Attach a black-market service set to a station (an entity with a trader, or a ship that can have one). The station keeps its own trade profile
 * and port market; the set adds to it: its stock lines on the shelf, its price mods and contraband buying (pricing.ts), the fence when it has one,
 * shady crew (galaxy/recruit.ts) and the node's truce flag when the set has a truce. If the set names an owner faction that exists, the station is
 * that faction's (so its standing sets the prices and the hail); otherwise the owner is left as it was. Idempotent for a set already attached.
 * Returns false for an unknown set or an entity that cannot trade.
 */
export function attachServices(sim: Sim, station: number, setId: string): boolean {
  const def = sim.content.blackMarkets?.[setId];
  const t = ensureTrader(sim, station);
  if (!def || !t) return false;
  const have = t.services ?? [];
  if (have.includes(setId)) return true;
  t.services = [...have, setId];
  const id = stationIdentity(sim.world.get(station, ShipC)?.gen?.seed, station);
  const fence = rollFence(sim, def, id);
  if (fence !== undefined) t.fence = Math.max(t.fence ?? 0, fence);
  if (def.owner && sim.content.galaxy?.factions[def.owner]) t.owner = def.owner;
  for (const l of rollServiceStock(sim, def, id, strHash(setId))) {
    const line = t.stock.find((s) => s.item === l.item);
    if (line) line.count = Math.max(line.count, l.count);
    else t.stock.push({ item: l.item, count: l.count });
  }
  t.stock.sort((a, b) => (a.item < b.item ? -1 : 1));
  if (def.truce) setTruce(sim, sim.sector.node);
  sim.galaxy.rev++;
  return true;
}
