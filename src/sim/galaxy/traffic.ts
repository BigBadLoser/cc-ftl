import { ShipC } from '../combat/components';
import { atBattle, shipsHostile } from '../combat/engage';
import { startInspection } from '../inspect/start';
import { InspectionC, inspections } from '../inspect/types';
import { MiningPodC } from '../mining/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { playerShip } from '../trade/player';
import { VehicleC } from '../vehicles/components';
import { vehicleDefOf } from '../vehicles/lifecycle';
import { callingStation, minersField } from './business';
import { inPlay } from './fleetShips';
import { unit } from './hash';
import { activeCalls, startCall, tendCalls } from './trafficCall';
import { INSPECT_NPC_CHANCE, NPC_ACTIVITIES } from './tuningWar';
import type { Fleet } from './types';

/**
 * NPC ships go about their business in the player's node (#603), through the systems the player's own ships use: no NPC copy of a mechanic. Ships
 * never move (DESIGN "Combat"); their craft do. At most NPC_ACTIVITIES of these run at once (`npcActivities`):
 * - a trader's station sends its shuttle to call at it (trafficCall.ts, `freeShuttle` and the vehicle commands);
 * - a miner's idle mining pods go out to the field it works (`mining.order`, as the player's mining tool sends it), one trip an order; a hull with
 *   no pod bay doesn't mine;
 * - a patrol sends its inspectors over to a non-hostile trader or miner (`startInspection` with a target; settled by itself, inspect/flow.ts).
 */

/** NPC traffic running in the node: station shuttle calls out, NPC mining pods on an order, and inspections of NPC ships. */
export function npcActivities(sim: Sim): number {
  const me = playerShip(sim);
  const pods = sim.world.query(MiningPodC).filter((id) => {
    const home = sim.world.get(id, VehicleC)?.homeShip;
    return home !== undefined && home !== me;
  }).length;
  const checks = inspections(sim).filter((id) => sim.world.get(id, InspectionC)?.npc).length;
  return activeCalls(sim) + pods + checks;
}

/** The fleet's ships in play in the node and free for their business (not fighting), lowest id first. */
const working = (sim: Sim, f: Fleet): number[] =>
  f.ships.flatMap((c) => (c.ship !== undefined && inPlay(sim, c.ship) && sim.world.get(c.ship, ShipC)?.state === 'active' && !atBattle(sim, c.ship) ? [c.ship] : [])).sort((a, b) => a - b);

/** The fleets of `role` in the player's node, lowest id first. */
const here = (sim: Sim, role: Fleet['role']): Fleet[] => sim.galaxy.fleets.filter((f) => f.node === sim.galaxy.current && f.role === role).sort((a, b) => a.id - b.id);

/** NPC mining pods on an order whose first trip is ending are recalled: an NPC pod's order is one trip, so the other business gets its turn. */
function oneTrip(sim: Sim): void {
  const me = playerShip(sim);
  for (const pod of sim.world.query(MiningPodC)) {
    const o = sim.world.get(pod, MiningPodC);
    if (!o || o.recall || sim.world.get(pod, VehicleC)?.homeShip === me) continue;
    if (o.phase === 'returning' || o.phase === 'unloading') sim.enqueue({ type: 'mining.recall', pod });
  }
}

/** A miner's stowed mining pods are ordered out to the field, while there is room. */
function mine(sim: Sim, room: number): number {
  const field = minersField(sim);
  if (field === undefined) return room;
  for (const f of here(sim, 'miner')) {
    for (const ship of working(sim, f)) {
      for (const pod of [...sim.world.query(VehicleC)].sort((a, b) => a - b)) {
        if (room <= 0) return room;
        const v = sim.world.get(pod, VehicleC);
        if (v?.homeShip !== ship || v.state !== 'stowed' || !vehicleDefOf(sim, v)?.mining || sim.world.has(pod, MiningPodC)) continue;
        sim.enqueue({ type: 'mining.order', pod, asteroid: field });
        room--;
      }
    }
  }
  return room;
}

/** A trader's station sends its shuttle to call at it, while there is room. */
function call(sim: Sim, room: number): number {
  for (const f of here(sim, 'trader')) {
    const station = callingStation(sim, f, sim.galaxy.current);
    if (station === undefined) continue;
    for (const ship of working(sim, f)) {
      if (room <= 0) return room;
      if (startCall(sim, station, ship)) room--;
    }
  }
  return room;
}

/** A patrol sends its inspectors to a non-hostile NPC trader or miner: one inspection at a time, in a turn its roll allows (INSPECT_NPC_CHANCE). */
function inspect(sim: Sim, room: number): number {
  if (room <= 0 || inspections(sim).some((id) => sim.world.get(id, InspectionC)?.npc)) return room;
  const turn = sim.galaxy.turn;
  for (const f of here(sim, 'patrol')) {
    if (unit(sim.seed, f.id, turn, 0x1e5) >= INSPECT_NPC_CHANCE) continue;
    const ship = working(sim, f)[0];
    if (ship === undefined) continue;
    const targets = [...here(sim, 'trader'), ...here(sim, 'miner')].flatMap((t) => working(sim, t)).filter((t) => !shipsHostile(sim, ship, t));
    if (!targets.length) continue;
    const target = targets[Math.floor(unit(sim.seed, f.id, turn, 0x7a6) * targets.length)];
    if (!startInspection(sim, ship, f.faction, sim.world.get(ship, ShipC)?.name ?? f.faction, target)) continue;
    const id = inspections(sim).find((v) => sim.world.get(v, InspectionC)?.ship === target);
    const insp = id === undefined ? undefined : sim.world.get(id, InspectionC);
    if (insp) insp.patrol = f.id; // held in the node until it is over (inspect/holds.ts), as for the player's
    return room - 1;
  }
  return room;
}

/** The traffic system's work: calls move along each tick; once a second, new business starts while there is room. */
export function tendTraffic(sim: Sim): void {
  tendCalls(sim);
  if (sim.tick % TICK_HZ !== 0) return;
  oneTrip(sim);
  // Mining last: its pods would otherwise take every turn (they are always free to go).
  let room = NPC_ACTIVITIES - npcActivities(sim);
  room = inspect(sim, room);
  room = call(sim, room);
  mine(sim, room);
}
