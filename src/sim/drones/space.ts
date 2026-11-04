import { ALT, type Body } from '../body';
import { ModuleC } from '../modules/components';
import { rotatedSize } from '../modules/footprint';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { DRONE_HATCH_SHARE, DRONE_LIFT_SEC } from '../tuning';
import { slotTile } from './bay';
import type { Drone } from './components';

/**
 * Drones in space (DESIGN.md "Drones", ARCHITECTURE "Drones"). Out of the ship a drone is a free body like a shuttle: it steers in a straight
 * line in sector tiles at cruise height and never meets a tile. It gets there only through its bay's ceiling hatch: a launch slides it from
 * its pad to the middle of the bay while the hatch opens, then lifts it out; a landing is the same backwards.
 */

/** Steer the body straight at (x, y) for one tick at `speed` tiles a second. True once it is there. */
export function steer(b: Body, x: number, y: number, speed: number): boolean {
  const dx = x - b.x, dy = y - b.y;
  const dist = Math.hypot(dx, dy);
  const step = speed / TICK_HZ;
  if (dist > 1e-9) b.heading = Math.atan2(dy, dx);
  if (dist <= step) {
    b.x = x;
    b.y = y;
    return true;
  }
  b.x += (dx / dist) * step;
  b.y += (dy / dist) * step;
  return false;
}

/** The middle of a bay's footprint (sector tiles): where its ceiling hatch is. */
export function hatchPoint(sim: Sim, bay: number): { x: number; y: number } | null {
  const m = sim.world.get(bay, ModuleC);
  const def = m && sim.content.modules[m.def];
  if (!m || !def) return null;
  const [w, h] = rotatedSize(def, m.rot);
  return { x: m.x + w / 2, y: m.y + h / 2 };
}

/** The centre of a bay slot's tile. */
export function padPoint(sim: Sim, bay: number, slot: number): { x: number; y: number } {
  const t = slotTile(sim, bay, slot);
  return { x: t.x + 0.5, y: t.y + 0.5 };
}

const smooth = (k: number): number => k * k * (3 - 2 * k);

/**
 * Pose of a drone `lift` (0..1) of the way through a launch (`up`) or a landing, between its pad and the hatch: the first DRONE_HATCH_SHARE of
 * a launch it slides to the hatch at pad height (the hatch opens), then rises to cruise height; a landing comes down first, then slides.
 */
export function liftPose(pad: { x: number; y: number }, hatch: { x: number; y: number }, lift: number, up: boolean): { x: number; y: number; alt: number } {
  const k = up ? lift : 1 - lift;
  const h = DRONE_HATCH_SHARE;
  if (k < h) {
    const s = smooth(k / h);
    return { x: pad.x + (hatch.x - pad.x) * s, y: pad.y + (hatch.y - pad.y) * s, alt: ALT.dronePad };
  }
  return { x: hatch.x, y: hatch.y, alt: ALT.dronePad + (ALT.cruise - ALT.dronePad) * smooth((k - h) / (1 - h)) };
}

/** One tick of a launch or a landing. True when it is over. With its bay gone it goes straight up (or down) where it is. */
export function stepLift(sim: Sim, d: Drone, b: Body, up: boolean): boolean {
  d.lift = Math.min(1, d.lift + 1 / (DRONE_LIFT_SEC * TICK_HZ));
  const hatch = d.bay ? hatchPoint(sim, d.bay) : null;
  const pad = hatch ? padPoint(sim, d.bay, d.slot) : { x: b.x, y: b.y };
  const p = liftPose(pad, hatch ?? pad, d.lift, up);
  if (Math.hypot(p.x - b.x, p.y - b.y) > 1e-9) b.heading = Math.atan2(p.y - b.y, p.x - b.x);
  b.x = p.x;
  b.y = p.y;
  b.alt = p.alt;
  return d.lift >= 1;
}
