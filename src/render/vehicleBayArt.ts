import type { World } from '../sim/ecs';
import { isLandingPad } from '../sim/modules/landingPad';
import type { Module } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';
import { VehicleBayC, VehicleC } from '../sim/vehicles/components';
import type { ModuleLayer } from './moduleArt';

/** One animation frame lasts this long (ms). */
export const BAY_FRAME_MS = 140;

/** One step of a bay animation: the bay sprite state, and the parked-shuttle state drawn over it (null = no shuttle). */
export interface BayStep {
  bay: string;
  shuttle: string | null;
}

const step = (bay: string, shuttle: string | null = null): BayStep => ({ bay, shuttle });
const HOLD = 8;

/**
 * Launch: the claws fold back, the doors slide open under the still parked shuttle, it lifts out (the sector-layer shuttle
 * sprite takes over at LAUNCH_LIFT.start, see shuttleView), hold open, close. Return: the doors open, the shuttle settles
 * into the pit (RETURN_LAND), the doors close and the claws close on the parked shuttle. Indices are animation frames
 * (BAY_FRAME_MS each); sprites: vehicleBay art ids, see tools/blender/sprites/vehicle_bay.py.
 */
export const LAUNCH: readonly BayStep[] = [
  step('fold.f0', 'fold.f0'), step('fold.f1', 'fold.f1'),
  step('open.f0', 'fold.f1'), step('open.f1', 'fold.f1'), step('open.f2', 'fold.f1'),
  ...Array.from({ length: HOLD }, () => step('open.f2')), step('open.f1'), step('open.f0'),
];
export const RETURN: readonly BayStep[] = [
  step('open.f0'), step('open.f1'), step('open.f2'), ...Array.from({ length: HOLD }, () => step('open.f2')), step('open.f1'), step('open.f0'),
  step('fold.f1', 'fold.f1'), step('fold.f0', 'fold.f0'),
];
/** Frame ranges in which the shuttle is drawn by the sector layer: lifting off the pit floor, settling back into it. */
export const LAUNCH_LIFT = { start: 5, end: 12 };
export const RETURN_LAND = { start: 3, end: 13 };

/** The steady state: the shuttle home in its claws, or the empty bay. */
export const steady = (home: boolean): BayStep => (home ? step('', '') : step('empty'));

type Anim = { steps: readonly BayStep[]; start: number };
interface Track {
  home: boolean;
  anim: Anim | null;
}

/** Remembers each bay's shuttle state between frames and plays the launch / return sequence when it changes. Render-only. */
export function createBayAnimator(): { stepOf(bay: number, home: boolean, now: number): BayStep; forget(bay: number): void } {
  const tracks = new Map<number, Track>();
  return {
    stepOf(bay, home, now) {
      let t = tracks.get(bay);
      if (!t) tracks.set(bay, (t = { home, anim: null }));
      if (t.home !== home) {
        t.anim = { steps: home ? RETURN : LAUNCH, start: now };
        t.home = home;
      }
      if (t.anim) {
        const i = Math.floor((now - t.anim.start) / BAY_FRAME_MS);
        const s = t.anim.steps[i];
        if (s) return s;
        t.anim = null;
      }
      return steady(home);
    },
    forget(bay) {
      tracks.delete(bay);
    },
  };
}

/** True when the bay's vehicle is stowed in it (the shuttle hangs in the claws). */
export function shuttleHome(world: World, bay: number): boolean {
  const vb = world.get(bay, VehicleBayC);
  const v = vb?.vehicle ? world.get(vb.vehicle, VehicleC) : undefined;
  return v?.state === 'stowed';
}

/** Asset id of a bay sprite state, and of the shuttle parked in it. */
export const bayId = (asset: string, rot: number, state: string): string => `${asset}.r${rot}${state ? `.${state}` : ''}`;
export const parkedId = (rot: number, state: string, craft = 'vehicle.shuttle'): string => `${craft}.parked.r${rot}${state ? `.${state}` : ''}`;
/** The craft a bay of this class parks (art id prefix): pod bays hold mining pods, the rest shuttles. */
const craftOf = (def: ModuleDef): string => (def.vehicleBay?.class === 'pod' ? 'vehicle.mining_pod' : 'vehicle.shuttle');

/** The parked shuttle sorts over the bay's own glow and halo (key + 0.01 / 0.015), so the pit's lights never paint over it. */
export const PARKED_DZ = 0.019;

/**
 * Sprite layers of a vehicle bay, bottom first: the bay (pit, doors, gangway, towers and claws), then the shuttle parked in
 * it, rendered with that bay state as a holdout, so it is drawn after the bay and only shows where it is in front of it. Both
 * are cut into screen strips (see moduleView) so crew beside the pit sort against the near lip, towers and gangway.
 */
export function vehicleBayLayers(m: Module, def: ModuleDef, s: BayStep): ModuleLayer[] {
  const a = def.asset;
  // A landing pad (#509) is one flat sprite; the shuttle on it is the shuttle view's.
  if (isLandingPad(def)) return [{ chain: [`${a}.r${m.rot}`, a], key: a, tiles: 'all' }];
  const out: ModuleLayer[] = [{ chain: [bayId(a, m.rot, s.bay), bayId(a, m.rot, ''), a], key: a, tiles: 'all', strips: true }];
  const craft = craftOf(def);
  if (s.shuttle !== null) out.push({ chain: [parkedId(m.rot, s.shuttle, craft), parkedId(m.rot, '', craft)], key: `${craft}.parked`, tiles: 'all', strips: true, dz: PARKED_DZ });
  return out;
}

/** Smoothstep 0..1. */
export const ease = (k: number): number => {
  const c = Math.max(0, Math.min(1, k));
  return c * c * (3 - 2 * c);
};

/**
 * The one answer to "who draws a vehicle that is leaving or entering its bay": the bay's parked layer (`drawn` false) or the sector
 * layer (`drawn` true). A launch hands over at LAUNCH_LIFT.start, as the doors stand open; a landing is the sector layer's until the
 * claws close on the parked craft (RETURN_LAND.end). `lift` is the craft's height while it rises out of the pit or settles into it
 * (0 pit floor .. 1 cruise), null once it is in plain flight or parked. `sinceLaunch` / `sinceLand` are ms since the state change
 * (Infinity if none).
 */
export function bayHandoff(stowed: boolean, sinceLaunch: number, sinceLand: number): { drawn: boolean; lift: number | null } {
  if (stowed) {
    if (sinceLand >= RETURN_LAND.end * BAY_FRAME_MS) return { drawn: false, lift: null };
    return { drawn: true, lift: 1 - ease((sinceLand - RETURN_LAND.start * BAY_FRAME_MS) / ((RETURN_LAND.end - RETURN_LAND.start - 2) * BAY_FRAME_MS)) };
  }
  if (sinceLaunch < LAUNCH_LIFT.start * BAY_FRAME_MS) return { drawn: false, lift: null };
  if (sinceLaunch >= LAUNCH_LIFT.end * BAY_FRAME_MS) return { drawn: true, lift: null };
  return { drawn: true, lift: ease((sinceLaunch - LAUNCH_LIFT.start * BAY_FRAME_MS) / ((LAUNCH_LIFT.end - LAUNCH_LIFT.start) * BAY_FRAME_MS)) };
}
