import { AwayC, AwaySiteC, SiteRunC } from '../away/components';
import { ofSide } from '../away/crew';
import { openSite } from '../away/handlers';
import { notRecallable, recallCrew } from '../away/recall';
import { shipById } from '../combat/ships';
import { PositionC } from '../crew/components';
import { FerryC } from '../ferry/components';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { isLive } from '../trade/deals';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { occupants } from '../vehicles/lifecycle';
import { boardingSite } from './launch';
import { cancelSabotage } from './sabotage';

/**
 * `crew.recall` (#287): boarders called home. Their sabotage orders end (`cancelled`); the away site's run brings them aboard and home
 * (away/recall.ts). `crew.recallStarted` names who goes, per shuttle, with those who could not (listed once, on the first);
 * `crew.recallFailed` names those who could not, per reason. Returns a reject reason when nobody could be sent.
 */
export function orderRecall(sim: Sim, ids: readonly number[]): string | null {
  joinLanded(sim, ids);
  cancelSabotage(sim, ids.filter((c) => notRecallable(sim, c) === null));
  const { sent, left } = recallCrew(sim, ids);
  const byReason = new Map<string, number[]>();
  for (const l of left) byReason.set(l.reason, [...(byReason.get(l.reason) ?? []), l.crew]);
  for (const [reason, crew] of byReason) sim.events.emit({ type: 'crew.recallFailed', vehicle: 0, crew, reason });
  let first = true;
  for (const [vehicle, crew] of [...sent].sort((a, b) => a[0] - b[0])) {
    const ship = sim.world.get(crew[0] as number, AwayC)?.site ?? 0;
    sim.events.emit({ type: 'crew.recallStarted', vehicle, ship, crew: [...crew], left: first ? left : [] });
    first = false;
  }
  return sent.size > 0 ? null : (left[0]?.reason ?? 'noCrew');
}

/**
 * Boarders landed by hand (a shuttle flown to the enemy airlock and its crew let out from the shuttle panel, no `boarding.launch`) join a
 * boarding site when they are recalled, so the recall is the same one: the ship's site if a party already boards it, else a site opened
 * for the shuttle of their side docked there (the lowest free one). Those still sitting in that shuttle are of the party too, aboard for
 * home. Crew with no such shuttle stay out of any party (`notAboard`).
 */
function joinLanded(sim: Sim, ids: readonly number[]): void {
  for (const c of [...new Set(ids)].sort((a, b) => a - b)) {
    const pos = sim.world.get(c, PositionC);
    if (!pos || sim.world.has(c, AwayC) || notRecallable(sim, c) === 'noCrew') continue;
    const ship = shipIdOf(sim, pos);
    const host = shipById(sim, ship);
    if (!host || host.faction === 'player') continue;
    let site = sim.world.get(ship, AwaySiteC);
    if (!site) {
      const v = landedShuttle(sim, c, ship);
      if (!v || openSite(sim, ship, 'boarding', v) === 'noShuttle') continue;
      const vehicle = sim.world.get(v, VehicleC) as Vehicle;
      site = Object.assign(sim.world.get(ship, AwaySiteC)!, boardingSite(vehicle.dock));
      // Already beside the site: the run finds itself there and stays (away/run.ts `fly`), flying itself from here on.
      Object.assign(sim.world.get(v, SiteRunC)!, { phase: 'fly', timer: 0 });
      vehicle.autopilot = true;
      for (const o of occupants(vehicle)) if (!sim.world.has(o, AwayC)) sim.world.add(o, AwayC, { site: ship, vehicle: v, cat: 'patrol', home: true });
    }
    if (!ofSide(sim, c, site.vehicle)) continue;
    sim.world.add(c, AwayC, { site: ship, vehicle: site.vehicle, cat: 'patrol' });
  }
}

/** The lowest shuttle of the crew member's side docked at `ship` and free of any other owner (a site, a cargo run, a deal), or 0. */
function landedShuttle(sim: Sim, c: number, ship: number): number {
  return [...sim.world.query(VehicleC)].sort((a, b) => a - b).find((id) => {
    const v = sim.world.get(id, VehicleC) as Vehicle;
    if (v.state !== 'docked' || shipIdOf(sim, sim.world.get(v.dock, ModuleC)) !== ship || !ofSide(sim, c, id)) return false;
    return !sim.world.has(id, SiteRunC) && !sim.world.has(id, FerryC) && !v.outbound && !sim.trade.deals.some((d) => d.vehicle === id && isLive(d));
  }) ?? 0;
}
