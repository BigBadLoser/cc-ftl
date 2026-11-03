import { AwayC, AwaySiteC, SiteRunC, type AwaySite } from '../away/components';
import { openSite } from '../away/handlers';
import { shipById } from '../combat/ships';
import { CrewC, DeadC } from '../crew/components';
import { AllegianceC } from '../fight/components';
import { FerryC } from '../ferry/components';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { isLive } from '../trade/deals';
import { VehicleC } from '../vehicles/components';
import { dockError } from '../vehicles/handlers';
import { occupants, vehicleDefOf, vehicleFaction } from '../vehicles/lifecycle';

/**
 * `boarding.launch` (#287): a boarding is an away site on the enemy ship (docs/DESIGN.md "Air, away sites and salvage"). The order opens
 * one with the player's pick as its named party (`AwaySite.invited`: their passages are theirs alone, held for them at once), the chosen
 * airlock to dock at, no work demand (the shuttle brings nobody else and no rotation), carrying on through the fight it is part of
 * (`fight: 'stay'`), and the party landing drafted, standing by for orders. The site's run does the rest: the walk to the bay, the flight,
 * docking, landing, trips home for the hurt and the recalled (`crew.recall`), and the way back for those who stay. Returns a reject reason,
 * or null.
 */
export function orderLaunch(sim: Sim, vehicle: number, crew: readonly number[], airlock: number): string | null {
  const v = sim.world.get(vehicle, VehicleC);
  if (!v) return 'noVehicle';
  if (vehicleFaction(sim, v) !== 'player') return 'badVehicle';
  // One owner at a time: not while it serves a site, a cargo run, a trade deal or an outbound trip.
  if (sim.world.has(vehicle, FerryC) || sim.world.has(vehicle, SiteRunC) || v.outbound || sim.trade.deals.some((d) => d.vehicle === vehicle && isLive(d))) return 'shuttleBusy';
  if (v.state !== 'stowed' || occupants(v).length > 0) return 'notStowed';
  const ids = [...new Set(crew)];
  if (ids.length < 1) return 'noCrew';
  if (ids.length > (vehicleDefOf(sim, v)?.capacity ?? 0) + 1) return 'full';
  const ship = shipIdOf(sim, sim.world.get(airlock, ModuleC));
  const host = shipById(sim, ship);
  if (!host || host.faction === 'player') return 'badTarget';
  const err = dockError(sim, vehicle, airlock);
  if (err) return err;
  for (const c of ids) {
    if (sim.world.get(c, AllegianceC)?.faction !== 'player' || !sim.world.has(c, CrewC) || sim.world.has(c, DeadC)) return 'noCrew';
  }
  if (ids.some((c) => sim.world.has(c, AwayC) || launchOf(sim, c))) return 'crewBusy'; // already of a party, or picked for another launch
  if (sim.world.has(ship, AwaySiteC)) return 'siteOpen'; // one site per ship: a party already boards it
  const opened = openSite(sim, ship, 'boarding', vehicle);
  if (opened === 'noShuttle') return 'notStowed';
  Object.assign(sim.world.get(ship, AwaySiteC)!, boardingSite(airlock), { invited: ids });
  return null;
}

/** What makes an away site a boarding: no work demand (no rotation), it carries on through the fight it is part of, its party lands
 * drafted (standing by for orders), and its shuttle docks at `airlock` (another one, or the hatch, if that one is lost). */
export const boardingSite = (airlock: number): Pick<AwaySite, 'demand' | 'fight' | 'standBy' | 'dock'> => ({ demand: {}, fight: 'stay', standBy: true, dock: airlock });

/** The shuttle whose boarding launch has picked `crew` and not taken them aboard yet (0 if none): the party is reserved from the order on. */
export function launchOf(sim: Sim, crew: number): number {
  for (const ship of sim.world.query(AwaySiteC)) {
    const s = sim.world.get(ship, AwaySiteC)!;
    if (s.invited?.includes(crew) && !sim.world.has(crew, AwayC)) return s.vehicle;
  }
  return 0;
}
