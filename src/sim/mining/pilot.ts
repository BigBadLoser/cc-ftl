import { AllegianceC } from '../fight/components';
import { AboardC, EmbarkOrderC, VehicleC, type Vehicle } from '../vehicles/components';
import { CrewC, DeadC, DraftedC, PositionC } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { shipById } from '../combat/ships';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { stat } from '../stats';
import { boardingTile } from '../vehicles/geometry';
import { unboardCrew } from '../vehicles/lifecycle';
import { sendToEmbark } from '../vehicles/embark';
import { MiningPodC, type MiningPod } from './components';
import { TICK_HZ } from '../time';

/** While an order waits for a pilot, it looks for one this often. */
const PILOT_RETRY_TICKS = 5 * TICK_HZ;

/** Crew reserved by any mining order. */
function reserved(sim: Sim): Set<number> {
  const out = new Set<number>();
  for (const id of sim.world.query(MiningPodC)) {
    const p = sim.world.get(id, MiningPodC)?.pilot;
    if (p) out.add(p);
  }
  return out;
}

/**
 * The crew member to fly a pod: on its home ship, of that ship's side, able, not drafted (a free schedule), not already
 * reserved by another order or walking to a vehicle. Highest piloting first, then the lowest id. 0 for none.
 */
export function pickPilot(sim: Sim, v: Vehicle): number {
  const faction = shipById(sim, v.homeShip)?.faction;
  const taken = reserved(sim);
  let best = 0;
  let bestSkill = -Infinity;
  for (const id of [...sim.world.query(CrewC, PositionC)].sort((a, b) => a - b)) {
    if (taken.has(id) || sim.world.has(id, DeadC) || sim.world.has(id, DraftedC) || sim.world.has(id, EmbarkOrderC) || sim.world.has(id, AboardC)) continue;
    if (isIncapacitated(sim, id) || sim.world.get(id, AllegianceC)?.faction !== faction) continue;
    if (shipIdOf(sim, sim.world.get(id, PositionC)) !== v.homeShip) continue;
    const skill = stat(sim, id, 'piloting');
    if (skill > bestSkill) {
      best = id;
      bestSkill = skill;
    }
  }
  return best;
}

/**
 * Make sure a stowed pod has its pilot aboard: keep the reserved one walking over, or pick and send a new one. Returns true
 * once the pilot is aboard. Emits `mining.waiting` once while nobody is free (the order waits; there is no crewless launch).
 */
export function ensurePilot(sim: Sim, pod: number, v: Vehicle, order: MiningPod): boolean {
  if (v.pilot) {
    order.pilot = v.pilot;
    order.waiting = false;
    return true;
  }
  const walking = order.pilot && sim.world.get(order.pilot, EmbarkOrderC)?.vehicle === pod;
  if (walking) return false;
  if (order.pilot) {
    // the reserved pilot gave up (no path to the bay) or was taken: release them, and look again in a while
    if (sim.world.has(order.pilot, DraftedC) && !sim.world.has(order.pilot, AboardC)) {
      sim.world.remove(order.pilot, DraftedC);
      const c = sim.world.get(order.pilot, CrewC);
      if (c) c.activity = 'idle';
    }
    order.pilot = 0;
  }
  if (order.waiting && (sim.tick + pod) % PILOT_RETRY_TICKS !== 0) return false;
  order.pilot = pickPilot(sim, v);
  if (order.pilot && !sendToEmbark(sim, order.pilot, pod)) {
    order.waiting = false;
    sim.events.emit({ type: 'mining.pilotSent', pod, crew: order.pilot });
    return false;
  }
  order.pilot = 0;
  if (!order.waiting) sim.events.emit({ type: 'mining.waiting', pod, reason: 'noPilot' });
  order.waiting = true;
  return false;
}

/** At the end of an order a stowed pod's pilot climbs out at the bay and goes back to their schedule. */
export function releasePilot(sim: Sim, pod: number, order: MiningPod): void {
  // Still walking over: call it off and send them back to their schedule.
  if (order.pilot && sim.world.get(order.pilot, EmbarkOrderC)?.vehicle === pod) {
    sim.world.remove(order.pilot, EmbarkOrderC);
    sim.world.remove(order.pilot, DraftedC);
    const c = sim.world.get(order.pilot, CrewC);
    if (c) c.activity = 'idle';
  }
  const v = sim.world.get(pod, VehicleC);
  const at = boardingTile(sim, pod);
  if (!v?.pilot || v.state !== 'stowed' || !at) return;
  unboardCrew(sim, v.pilot, pod, at);
}
