import { ALT, BodyC, type Body } from '../body';
import { cargoAdd, cargoCount, cargoSpace } from '../vehicles/cargo';
import { bumpStat } from '../story/goals';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { bayCenter, bayWorking } from '../vehicles/geometry';
import { vehicleDefOf, vehicleSpeedPerTick } from '../vehicles/lifecycle';
import { MiningPodC, type MiningPod } from '../mining/components';
import { hoverSpot, isOreTile, pickTile } from '../mining/pick';
import { ensurePilot, releasePilot } from '../mining/pilot';
import type { Sim } from '../sim';
import { Struct, writeStruct } from '../structure';
import { TICK_HZ } from '../time';
import { XP_PER_WORK_SEC } from '../tuning';
import { grantXp } from '../crew/xp';

/** The item an ore code yields, or undefined. */
function oreItem(sim: Sim, code: number): string | undefined {
  for (const o of Object.values(sim.content.ores ?? {})) if (o.code === code) return o.item;
  return undefined;
}

function end(sim: Sim, pod: number, order: MiningPod, reason: 'exhausted' | 'recalled' | 'lost'): void {
  sim.world.remove(pod, MiningPodC);
  releasePilot(sim, pod, order);
  sim.events.emit({ type: 'mining.done', pod, asteroid: order.asteroid, reason, trips: order.trips });
}

function goHome(sim: Sim, pod: number, v: Vehicle, order: MiningPod): void {
  order.phase = 'returning';
  order.target = null;
  order.spot = null;
  v.dest = { type: 'bay' };
  sim.events.emit({ type: 'mining.returning', pod, cargo: cargoCount(v) });
}

/** Fly straight at a point (sector coordinates); true on arrival. */
function approach(sim: Sim, v: Vehicle, b: Body, to: { x: number; y: number }): boolean {
  const dx = to.x - b.x;
  const dy = to.y - b.y;
  const dist = Math.hypot(dx, dy);
  const step = vehicleSpeedPerTick(sim, v);
  if (dist > 0.0001) b.heading = Math.atan2(dy, dx);
  b.alt = ALT.cruise;
  if (dist > step) {
    b.x += (dx / dist) * step;
    b.y += (dy / dist) * step;
    return false;
  }
  b.x = to.x;
  b.y = to.y;
  return true;
}

/** Aim the order at a tile, with a hover spot clear of every other pod (a pod's width apart). */
function aim(sim: Sim, pod: number, v: Vehicle, order: MiningPod, t: { x: number; y: number }): void {
  order.target = t;
  order.spot = hoverSpot(sim, pod, t, vehicleDefOf(sim, v)?.size ?? 1);
}

/** Cut ore off the target tile at the pod's laser rate into its hold; an emptied tile becomes Space. */
function mine(sim: Sim, pod: number, v: Vehicle, order: MiningPod): void {
  const t = order.target as { x: number; y: number };
  const g = sim.sector.grid;
  order.progress += (vehicleDefOf(sim, v)?.mining?.unitsPerSec ?? 0) / TICK_HZ;
  while (order.progress >= 1 && cargoSpace(sim, v) > 0 && isOreTile(sim, order.asteroid, t.x, t.y)) {
    order.progress -= 1;
    const item = oreItem(sim, g.get('ore', t.x, t.y));
    if (item) cargoAdd(sim, pod, item, 1);
    const left = g.get('oreAmt', t.x, t.y) - 1;
    g.set('oreAmt', t.x, t.y, left);
    if (left <= 0) {
      g.set('ore', t.x, t.y, 0);
      writeStruct(g, t.x, t.y, Struct.Space);
      sim.events.emit({ type: 'mining.tileCleared', pod, asteroid: order.asteroid, x: t.x, y: t.y });
    }
  }
}

/**
 * Mining pods. A pod with a `MiningPodC` order first gets a pilot (a free crew member walks over and climbs in; with nobody
 * free the order waits), then runs trips: launch from its bay with an empty hold, fly to the nearest unclaimed
 * ore tile of the order, laser it into the hold, hop to the next tile while there is room, fly home when full (or when nothing
 * is left, or on recall), and wait stowed while crew haul the ore to storage (the cargo planner unloads a stowed vehicle at its
 * bay's access tile). An empty pod with nothing left to mine, or recalled, ends the order (pods share an order's
 * tiles: another pod working the last one is not "nothing left") and its pilot climbs out (the
 * pilot stays aboard between trips). The vehicle system flies the leg home
 * and stows it; this system steers the outbound legs itself (a vehicle with no destination just holds position there).
 * Runs before the vehicle system.
 */
export function miningSystem(sim: Sim): void {
  for (const pod of [...sim.world.query(MiningPodC)].sort((a, b) => a - b)) {
    const order = sim.world.get(pod, MiningPodC) as MiningPod;
    const v = sim.world.get(pod, VehicleC);
    const b = sim.world.get(pod, BodyC);
    if (!v || !b) {
      sim.world.remove(pod, MiningPodC);
      continue;
    }
    if (v.state === 'docked') continue;
    if (v.state === 'stowed') {
      if (cargoCount(v) > 0) {
        // A pod home with ore: the goal chain counts the trip once, as it starts unloading.
        if (order.phase !== 'unloading') bumpStat(sim, 'gathered');
        order.phase = 'unloading';
        continue;
      }
      const from = bayCenter(sim, v.home) ?? b;
      const next = order.recall ? null : pickTile(sim, pod, order, from);
      if (!next) {
        end(sim, pod, order, order.recall ? 'recalled' : 'exhausted');
        continue;
      }
      if (!bayWorking(sim, v.home) || !ensurePilot(sim, pod, v, order)) continue;
      order.phase = 'outbound';
      aim(sim, pod, v, order, next);
      order.progress = 0;
      order.trips++;
      v.state = 'flying';
      v.dest = null;
      b.alt = ALT.cruise;
      sim.events.emit({ type: 'vehicle.launched', vehicle: pod, ship: v.homeShip, x: b.x, y: b.y });
      sim.events.emit({ type: 'mining.launched', pod, asteroid: order.asteroid, x: next.x, y: next.y, trip: order.trips });
      continue;
    }
    // flying: the pilot is at the controls
    if (v.pilot) grantXp(sim, v.pilot, 'piloting', XP_PER_WORK_SEC / TICK_HZ);
    if (order.phase === 'returning') {
      if (!v.dest && !bayWorking(sim, v.home)) end(sim, pod, order, 'lost'); // no bay to come home to: it holds where it is
      else if (!v.dest) v.dest = { type: 'bay' };
      continue;
    }
    if (order.recall || cargoSpace(sim, v) <= 0) {
      goHome(sim, pod, v, order);
      continue;
    }
    const t = order.target;
    if (!t || !isOreTile(sim, order.asteroid, t.x, t.y)) {
      const next = pickTile(sim, pod, order, b);
      if (!next) {
        goHome(sim, pod, v, order);
        continue;
      }
      aim(sim, pod, v, order, next);
      order.phase = 'outbound';
    }
    if (order.phase === 'outbound') {
      const to = order.spot ?? { x: (order.target as { x: number }).x + 0.5, y: (order.target as { y: number }).y + 0.5 };
      if (approach(sim, v, b, to)) order.phase = 'mining';
      continue;
    }
    // The pod faces the ore it cuts (the laser points at it).
    const face = order.target as { x: number; y: number };
    if (Math.hypot(face.x + 0.5 - b.x, face.y + 0.5 - b.y) > 0.0001) b.heading = Math.atan2(face.y + 0.5 - b.y, face.x + 0.5 - b.x);
    mine(sim, pod, v, order);
    if (cargoSpace(sim, v) <= 0) goHome(sim, pod, v, order);
  }
}
