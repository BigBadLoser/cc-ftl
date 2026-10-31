import { shipById } from '../combat/ships';
import { CrewC, DeadC, DraftedC } from '../crew/components';
import { clearPath, isIncapacitated } from '../crew/helpers';
import { abortTask } from '../ai/task';
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
import { BoardLaunchC, type BoardLaunch } from './components';

/** Ticks the party gets to reach the bay before the launch is called off (the crew who made it stay aboard). */
const LAUNCH_WALK_TICKS = 1500;
/** Ticks an aborted launch gets to fly home before it lets go of the shuttle. */
const RETURN_TICKS = 6000;

/**
 * `boarding.launch`: send `crew` (the first flies, the rest are passengers) to the stowed shuttle, then to the enemy airlock.
 * Returns a reject reason, or null. The launch system carries it out (see launchSystem).
 */
export function orderLaunch(sim: Sim, vehicle: number, crew: readonly number[], airlock: number): string | null {
  const v = sim.world.get(vehicle, VehicleC);
  if (!v) return 'noVehicle';
  if (vehicleFaction(sim, v) !== 'player') return 'badVehicle';
  // One owner at a time: not while it's on a cargo run, a trade deal or an outbound trip.
  if (sim.world.has(vehicle, BoardLaunchC) || sim.world.has(vehicle, FerryC) || v.outbound || sim.trade.deals.some((d) => d.vehicle === vehicle && isLive(d))) return 'shuttleBusy';
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
  if (ids.some((c) => launchOf(sim, c))) return 'crewBusy'; // already picked for another launch
  const pilotDrafted = sim.world.has(ids[0] as number, DraftedC);
  const first = sendToEmbark(sim, ids[0] as number, vehicle);
  if (first) return first;
  // The rest of the party is called off their work and held (drafted, standing by) until their turn to walk: no job, mining pod
  // or cargo run picks them meanwhile, since every automated selector skips drafted crew. `held` remembers whom the launch drafted,
  // so it lets go of exactly those (and not crew the player had drafted) when they don't fly.
  const held: number[] = pilotDrafted ? [] : [ids[0] as number];
  for (const c of ids.slice(1)) {
    if (sim.world.has(c, DraftedC)) continue;
    abortTask(sim, c, 'drafted');
    sim.world.add(c, DraftedC, { target: null });
    (sim.world.get(c, CrewC) as { activity: string }).activity = 'drafted';
    held.push(c);
  }
  sim.world.add(vehicle, BoardLaunchC, { crew: ids, airlock, state: 'pilot', since: sim.tick, held });
  return null;
}

/** The shuttle whose pending launch has picked `crew` (0 if none): the whole party is reserved from the moment the launch is accepted. */
export function launchOf(sim: Sim, crew: number): number {
  for (const id of sim.world.query(BoardLaunchC)) if (sim.world.get(id, BoardLaunchC)?.crew.includes(crew)) return id;
  return 0;
}

/** The party member still on its way: alive and able. */
const fit = (sim: Sim, c: number): boolean => sim.world.has(c, CrewC) && !sim.world.has(c, DeadC) && !isIncapacitated(sim, c);

/**
 * Let go of a party member who is not flying (left behind, or the launch is over): their walk to the shuttle stops, and crew the
 * launch drafted go back to work. Crew still aboard, or drafted by the player, stay as they are (standing by, for the latter).
 */
function release(sim: Sim, o: BoardLaunch, vehicle: number, c: number): void {
  if (sim.world.has(c, AboardC)) return;
  if (sim.world.get(c, EmbarkOrderC)?.vehicle === vehicle) sim.world.remove(c, EmbarkOrderC);
  const d = sim.world.get(c, DraftedC);
  if (!d) return;
  clearPath(sim, c);
  if (o.held?.includes(c) && !sim.world.has(c, DeadC)) {
    sim.world.remove(c, DraftedC);
    const crew = sim.world.get(c, CrewC) as { activity: string } | undefined;
    if (crew) crew.activity = 'idle';
  } else d.target = null;
}

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
      // Nothing of a called-off launch carries on: anyone already in the stowed shuttle climbs back out, and the whole party is let
      // go (walks stop, crew it drafted go back to work), so the shuttle and the crew are free for the next launch.
      if (v.state === 'stowed') {
        const at = boardingTile(sim, id);
        if (at) for (const c of occupants(v)) unboardCrew(sim, c, id, at);
      }
      for (const c of o.crew) release(sim, o, id, c);
      sim.events.emit({ type: 'command.rejected', command: 'boarding.launch', reason });
    };
    if (o.state === 'flying') {
      if (v.state === 'docked' && v.dock === o.airlock) {
        const at = boardingTile(sim, id);
        if (at) for (const c of occupants(v)) unboardCrew(sim, c, id, at); // the pilot lands too: the shuttle stays docked for the recall
        sim.world.remove(id, BoardLaunchC);
      } else if (!v.pilot || v.dest?.type !== 'dock' || v.dest.airlock !== o.airlock) {
        // The target airlock was lost on the way (or the pilot fell): fly the party home and step them out in the bay, rather than leave
        // them hovering or shut in the shuttle. With no pilot or no working bay the launch just ends and the shuttle panel takes over.
        if (v.pilot && v.state !== 'docked' && bayWorking(sim, v.home)) {
          v.hover = 0;
          v.dest = { type: 'bay' };
          o.state = 'returning';
          o.since = sim.tick;
          sim.events.emit({ type: 'command.rejected', command: 'boarding.launch', reason: 'aborted' });
        } else call('aborted');
      }
      continue;
    }
    if (o.state === 'returning') {
      if (v.state === 'stowed') {
        const at = boardingTile(sim, id);
        if (at) for (const c of occupants(v)) unboardCrew(sim, c, id, at);
        for (const c of o.crew) release(sim, o, id, c);
        sim.world.remove(id, BoardLaunchC);
      } else if (v.dest?.type !== 'bay' || sim.tick - o.since > RETURN_TICKS) sim.world.remove(id, BoardLaunchC); // lost its way home: the panel takes over
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
    // Whoever didn't make it aboard in time stays home: their walk stops and they go back to work, and the player hears of it.
    const late = rest.filter((c) => !sim.world.has(c, AboardC));
    for (const c of late) release(sim, o, id, c);
    if (late.some((c) => fit(sim, c))) sim.events.emit({ type: 'command.rejected', command: 'boarding.launch', reason: 'leftBehind' });
    v.hover = 0;
    v.dest = { type: 'dock', airlock: o.airlock };
    o.state = 'flying';
    o.since = sim.tick;
  }
}
