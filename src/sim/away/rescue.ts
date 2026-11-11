import { findFreeBed } from '../crew/beds';
import { CarriedC, CrewC, PositionC, type Crew } from '../crew/components';
import { origin } from '../crew/helpers';
import { SuitC } from '../eva/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { VehicleC } from '../vehicles/components';
import { boardCrew, occupants, vehicleDefOf } from '../vehicles/lifecycle';
import { AwayC } from './components';
import { siteSpot, siteUnderFoot } from './crew';

/**
 * Rescue on an away site (docs/DESIGN.md "Hurt crew", #286 slice 2b): a downed party member on a site with no free bed is carried to their
 * site's shuttle (that counts as handing them in) and goes home on the next trip, which leaves at once (a downed passenger is urgent).
 */

/** Where a downed party member is carried instead of a bed: their shuttle's hatch spot or docked airlock on the site. Null otherwise. */
export function rescueSpot(sim: Sim, patient: number): { x: number; y: number; vehicle: number } | null {
  const pos = sim.world.get(patient, PositionC);
  const away = sim.world.get(patient, AwayC);
  const site = siteUnderFoot(sim, patient);
  if (!pos || !away || !site || findFreeBed(sim, site, origin(pos), false, undefined, true)) return null;
  const spot = siteSpot(sim, away.vehicle, site);
  return spot && { x: spot.x, y: spot.y, vehicle: away.vehicle };
}

/** The carrier stands on (or beside) the spot: the patient is handed in aboard (their suit into stock). False while the shuttle is full or gone. */
export function handInPatient(sim: Sim, carrier: number, patient: number): boolean {
  const away = sim.world.get(patient, AwayC);
  const v = away && sim.world.get(away.vehicle, VehicleC);
  const me = sim.world.get(carrier, PositionC);
  const spot = away && me && siteSpot(sim, away.vehicle, shipIdOf(sim, me));
  if (!away || !v || !spot || Math.max(Math.abs(me.x - spot.x), Math.abs(me.y - spot.y)) > 1 || occupants(v).length >= (vehicleDefOf(sim, v)?.capacity ?? 0) + 1) return false;
  sim.world.remove(patient, CarriedC);
  sim.world.remove(patient, SuitC); // stowed aboard
  boardCrew(sim, patient, away.vehicle);
  (sim.world.get(patient, CrewC) as Crew).activity = 'downed';
  sim.world.add(patient, AwayC, { site: away.site, vehicle: away.vehicle, cat: away.cat, home: true });
  return true;
}
