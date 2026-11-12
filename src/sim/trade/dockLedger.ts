import { stowOrDrop } from '../items/deck';
import { storageCount, storageTake } from '../items/storage';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { cargoOf } from '../vehicles/cargo';
import { VehicleC } from '../vehicles/components';
import { playerShip } from './player';
import type { Deal } from './types';

/**
 * The exact units a docked station deal has moved (`Deal.dock`), so a deal that ends early moves only its own goods and never the station's unrelated
 * stock of the same item. `staged`: the bought goods set into station storage. `seen`: per item, the most of a bought item the shuttle's hold has
 * held (so the rest is still staged) or the least of a given item (so the rest left the hold toward the station). Updated every station-work tick.
 */

/** Note the shuttle's hold: the high mark of each bought item, the low mark of each given item. */
export function noteHolds(sim: Sim, d: Deal): void {
  const dock = d.dock;
  if (!dock) return;
  const seen = (dock.seen ??= {});
  for (const l of d.get) seen[l.item] = Math.max(seen[l.item] ?? 0, cargoOf(sim, d.vehicle, l.item));
  for (const l of d.give) if (!d.get.some((g) => g.item === l.item)) seen[l.item] = Math.min(seen[l.item] ?? l.count, cargoOf(sim, d.vehicle, l.item));
}

/** The exchange is done: nothing of this deal is staged or in motion any more (what is left of it is the trader's or the player's already). */
export function settleDock(d: Deal): void {
  if (!d.dock) return;
  d.dock.staged = [];
  d.dock.seen = {};
}

/** Units of a bought item still sitting staged in station storage: staged minus what reached the shuttle's hold. */
const stillStaged = (d: Deal, item: string): number =>
  (d.dock?.staged ?? []).filter((s) => s.item === item).reduce((n, s) => n + s.count, 0) - (d.dock?.seen?.[item] ?? 0);

/** Take this deal's still-staged bought goods back out of station storage (they return to the trader's stock). Only those units. */
export function unstage(sim: Sim, d: Deal): void {
  if (!d.dock) return;
  const left = new Map<string, number>();
  for (const l of d.get) left.set(l.item, Math.max(0, stillStaged(d, l.item)));
  for (const s of d.dock.staged) {
    const n = Math.min(s.count, left.get(s.item) ?? 0);
    if (n <= 0) continue;
    storageTake(sim, s.storage, s.item, n);
    left.set(s.item, (left.get(s.item) ?? 0) - n);
  }
  d.dock.staged = [];
}

/** Bought units that were in a lost shuttle's hold: they are gone with it (the trader's stock does not get them back). */
export function lostInHold(sim: Sim, d: Deal, item: string): number {
  return sim.world.has(d.vehicle, VehicleC) ? 0 : d.dock?.seen?.[item] ?? 0;
}

/**
 * A shuttle lost at the station after crew hauled the player's given goods into station storage: those goods go back to the player's ship (never
 * both refunded and kept by the station). Only the units the hold gave up, and only as many as the station still holds.
 */
export function returnGiven(sim: Sim, d: Deal): void {
  if (!d.dock || sim.world.has(d.vehicle, VehicleC)) return;
  for (const l of d.give) {
    if (d.get.some((g) => g.item === l.item)) continue;
    let left = l.count - (d.dock.seen?.[l.item] ?? l.count);
    let back = 0;
    for (const id of sim.world.query(ModuleC)) {
      if (left <= 0) break;
      if (shipIdOf(sim, sim.world.get(id, ModuleC)) !== d.ship || storageCount(sim, id, l.item) <= 0) continue;
      const n = storageTake(sim, id, l.item, left);
      left -= n;
      back += n;
    }
    if (back > 0) stowOrDrop(sim, playerShip(sim), l.item, back);
  }
}
