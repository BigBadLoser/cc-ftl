import { CrewC, DeadC, PositionC } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import type { Sim } from '../sim';
import { shipIdOf } from '../regions';
import { cargoCount } from '../vehicles/cargo';
import { AboardC, VehicleC } from '../vehicles/components';
import { vehicleDefOf } from '../vehicles/lifecycle';
import { FerryC } from './components';
import { ferryFree, ferryMode, isFerryRegion, isPickupRegion, pickFerryShuttle, regionItems } from './pick';

export interface FerryRequest {
  /** The shuttle, or 0 / absent for the first free one. */
  vehicle?: number;
  from: number;
  to: number;
  items?: { item: string; count: number }[];
  crew?: number[];
  /** The transfer order this trip serves (see logistics). */
  transfer?: number;
}

/**
 * Begin a run (the `ferry.order` command and the logistics system share it). Cargo lines are clipped to what the pickup region
 * holds and to the hold. Returns a reject reason, or null once the run is started.
 */
export function startFerry(sim: Sim, req: FerryRequest): string | null {
  const id = req.vehicle || pickFerryShuttle(sim);
  const v = sim.world.get(id, VehicleC);
  const def = v && vehicleDefOf(sim, v);
  if (!v || !def) return id ? 'noVehicle' : 'noShuttle';
  if (!ferryFree(sim, id)) return 'busy';
  if (req.from === req.to) return 'sameRegion';
  if (!isPickupRegion(sim, req.from) || !isFerryRegion(sim, req.to)) return 'badRegion';
  if (!ferryMode(sim, req.from, id) || !ferryMode(sim, req.to, id)) return 'noAirlock';
  const crew = [...new Set(req.crew ?? [])];
  for (const c of crew) {
    const pos = sim.world.get(c, PositionC);
    if (!sim.world.has(c, CrewC) || sim.world.has(c, DeadC) || sim.world.has(c, AboardC) || !pos || isIncapacitated(sim, c)) return 'noCrew';
    if (shipIdOf(sim, pos) !== req.from) return 'otherRegion';
  }
  if (crew.length > def.capacity + 1 - (v.pilot ? 1 : 0)) return 'full';
  const items: { item: string; count: number }[] = [];
  let room = def.cargo ?? 0;
  if ((req.items?.length ?? 0) > 0 && cargoCount(v) > 0) return 'holdBusy';
  for (const l of req.items ?? []) {
    if (!sim.content.items[l.item] || !Number.isInteger(l.count) || l.count <= 0) return 'badLine';
    const n = Math.min(l.count, regionItems(sim, req.from, l.item) - (items.find((x) => x.item === l.item)?.count ?? 0), room);
    if (n <= 0) continue;
    items.push({ item: l.item, count: n });
    room -= n;
  }
  if (items.length === 0 && crew.length === 0) return 'nothing';
  v.autopilot = true;
  v.hover = 0;
  sim.world.add(id, FerryC, { from: req.from, to: req.to, items, crew, phase: 'toFrom', timer: 0, ...(req.transfer ? { transfer: req.transfer } : {}) });
  sim.events.emit({ type: 'ferry.started', vehicle: id, from: req.from, to: req.to, items: items.reduce((n, l) => n + l.count, 0), crew: crew.length });
  return null;
}
