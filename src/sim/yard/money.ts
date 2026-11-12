import { stowOrDrop } from '../items/deck';
import { storageCount, storageTake } from '../items/storage';
import { StorageC } from '../items/components';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TraderC } from '../trade/types';
import { addStock } from '../trade/deals';
import { addCredits } from '../trade/credits';
import type { YardMoney, YardOrder } from './types';

const METAL = 'item.metal';

/** Storage modules of a ship, ascending id. */
function storagesOf(sim: Sim, ship: number): number[] {
  return sim.world.query(StorageC, ModuleC).filter((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === ship).sort((a, b) => a - b);
}

/** Take `n` metal out of a ship's storage modules. All or nothing: false (and nothing taken) when it holds less. */
export function takeMetal(sim: Sim, ship: number, n: number): boolean {
  const stores = storagesOf(sim, ship);
  if (stores.reduce((t, id) => t + storageCount(sim, id, METAL), 0) < n) return false;
  let left = n;
  for (const id of stores) left -= storageTake(sim, id, METAL, left);
  return true;
}

/** Put `n` metal back into a ship's storage; what does not fit lies on the deck. Returns the units that found no room anywhere. */
export function returnMetal(sim: Sim, ship: number, n: number): number {
  return stowOrDrop(sim, ship, METAL, n);
}

/** Give the unbuilt share of an order's price back to the player (credits, and the metal to the ship's storage). Returns what went back. */
export function refund(sim: Sim, o: YardOrder, share: YardMoney): YardMoney {
  const credits = Math.min(o.held.credits, share.credits);
  const metal = Math.min(o.held.metal, share.metal);
  const homeless = metal > 0 ? returnMetal(sim, o.ship, metal) : 0;
  o.held.credits -= credits;
  o.held.metal -= metal - homeless; // metal with nowhere to go stays held (never destroyed), and is not reported as returned
  addCredits(sim, credits);
  return { credits, metal: metal - homeless };
}

/** Pay what is still held to the station: credits into its wallet, metal into its stock (nothing happens if the station has no trader any more). */
export function payStation(sim: Sim, o: YardOrder): void {
  const trader = sim.world.get(o.station, TraderC);
  if (!trader) return;
  trader.credits += o.held.credits;
  if (o.held.metal > 0) addStock(trader.stock, METAL, o.held.metal);
  o.held = { credits: 0, metal: 0 };
}
