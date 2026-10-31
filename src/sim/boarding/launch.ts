import { shipById } from '../combat/ships';
import { CrewC, DeadC, DraftedC } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { AllegianceC } from '../fight/components';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { AboardC, EmbarkOrderC, VehicleC, type Vehicle } from '../vehicles/components';
import { sendToEmbark } from '../vehicles/embark';
import { bayWorking, boardingTile } from '../vehicles/geometry';
import { dockError, launch } from '../vehicles/handlers';
import { occupants, unboardCrew, vehicleDefOf, vehicleFaction } from '../vehicles/lifecycle';
import { FerryC } from '../ferry/components';
import { isLive } from '../trade/deals';
import { BoardLaunchC } from './components';

/** Ticks the party gets to reach the bay before the launch is called off (the crew who made it stay aboard). */
const LAUNCH_WALK_TICKS = 1500;

/**
 * `boarding.launch`: send `crew` (the first flies, the rest are passengers) to the stowed shuttle, then to the enemy airlock.
 * Returns a reject reason, or null. The launch system carries it out (see launchSystem).
 */
export function orderLaunch(sim: Sim, vehicle: number, crew: readonly number[], airlock: number): string | null {
  const v = sim.world.get(vehicle, VehicleC);
  if (!v) return 'noVehicle';
  if (vehicleFaction(sim, v) !== 'player') return 'badVehicle';
  // One owner at a time: not while it's on a cargo run, a trade deal or an outbound trip.
  if (sim.world.has(vehicle, BoardLaunchC) || sim.world.has(vehicle, FerryC) || v.outbound || sim.trade.deals.some((d) => d.vehicle === vehicle && isLive(d))) return 'busy';
  if (v.state !== 'stowed' || occupants(v).length > 0) return 'notStowed';
  const ids = [...new Set(crew)];
  if (ids.length < 1) return 'noCrew';
  if (ids.length > (vehicleDefOf(sim, v)?.capacity ?? 0) + 1) return 'full';
  const host = shipById(sim, shipIdOf(sim, sim.world.get(airlock, ModuleC)));
  if (!host || host.faction === 'player') return 'badTarget';
  const err = dockError(sim, vehicle, airlock);
  if (err) return err;
  for (const c of ids) {
    if (sim.world.get(c, AllegianceC)?.faction !== 'player') return 'noCrew';
  }
  const first = sendToEmbark(sim, ids[0] as number, vehicle);
  if (first) return first;
  sim.world.add(vehicle, BoardLaunchC, { crew: ids, airlock, state: 'pilot', since: sim.tick });
  return null;
}

/** The party member still on its way: alive and able. */
const fit = (sim: Sim, c: number): boolean => sim.world.has(c, CrewC) && !sim.world.has(c, DeadC) && !isIncapacitated(sim, c);

/**
 * Carries out `boarding.launch`: the pilot walks to the bay first (so the first one picked flies it), then the passengers; once they
 * are aboard (or have dropped out) the shuttle launches and docks at the airlock; when it latches on, everyone aboard (the pilot too) steps out onto the
 * enemy ship (drafted, as every landing on another faction's ship is). The shuttle stays docked; `crew.recall` flies the first one back home.
 */
export function launchSystem(sim: Sim): void {
  for (const id of sim.world.query(BoardLaunchC)) {
    const o = sim.world.get(id, BoardLaunchC);
    const v = sim.world.get(id, VehicleC) as Vehicle | undefined;
    if (!o || !v) {
      sim.world.remove(id, BoardLaunchC);
      continue;
    }
    const call = (reason: string): void => {
      sim.world.remove(id, BoardLaunchC);
      // Nothing of a called-off launch carries on: crew still walking to the bay stop, and anyone already in the stowed shuttle
      // climbs back out, so the shuttle is free for the next launch.
      for (const c of o.crew) {
        if (sim.world.get(c, EmbarkOrderC)?.vehicle !== id) continue;
        sim.world.remove(c, EmbarkOrderC);
        const d = sim.world.get(c, DraftedC);
        if (d) d.target = null;
      }
      if (v.state === 'stowed') {
        const at = boardingTile(sim, id);
        if (at) for (const c of occupants(v)) unboardCrew(sim, c, id, at);
      }
      sim.events.emit({ type: 'command.rejected', command: 'boarding.launch', reason });
    };
    if (o.state === 'flying') {
      if (v.state === 'docked' && v.dock === o.airlock) {
        const at = boardingTile(sim, id);
        if (at) for (const c of occupants(v)) unboardCrew(sim, c, id, at); // the pilot lands too: the shuttle stays docked for the recall
        sim.world.remove(id, BoardLaunchC);
      } else if (!v.pilot || v.dest?.type !== 'dock' || v.dest.airlock !== o.airlock) {
        // The pilot fell, or the target airlock was lost on the way: fly the party home rather than leave it hovering in space.
        if (v.pilot && v.state !== 'docked' && bayWorking(sim, v.home)) {
          v.hover = 0;
          v.dest = { type: 'bay' };
        }
        call('aborted');
      }
      continue;
    }
    const stalled = sim.tick - o.since > LAUNCH_WALK_TICKS;
    if (o.state === 'pilot') {
      const pilot = o.crew[0] as number;
      if (v.pilot === pilot) {
        o.state = 'loading';
        o.since = sim.tick;
        for (const c of o.crew.slice(1)) if (fit(sim, c) && !sim.world.has(c, AboardC)) sendToEmbark(sim, c, id);
      } else if (!fit(sim, pilot) || stalled || v.state !== 'stowed') call('noPilot');
      continue;
    }
    // loading: wait for everyone still coming
    const rest = o.crew.slice(1);
    const waiting = rest.some((c) => fit(sim, c) && sim.world.has(c, EmbarkOrderC));
    if (waiting && !stalled) continue;
    if (occupants(v).length === 0) {
      call('noCrew');
      continue;
    }
    const err = dockError(sim, id, o.airlock) ?? launch(sim, id, v);
    if (err) {
      call(err);
      continue;
    }
    v.hover = 0;
    v.dest = { type: 'dock', airlock: o.airlock };
    o.state = 'flying';
    o.since = sim.tick;
  }
}
