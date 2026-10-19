import type { World } from '../sim/ecs';
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
export const parkedId = (rot: number, state: string): string => `vehicle.shuttle.parked.r${rot}${state ? `.${state}` : ''}`;

/**
 * Sprite layers of a vehicle bay, bottom first: the bay (pit, doors, gangway, towers and claws), then the shuttle parked in
 * it, rendered with that bay state as a holdout, so it is drawn after the bay and only shows where it is in front of it. Both
 * are cut into screen strips (see moduleView) so crew beside the pit sort against the near lip, towers and gangway.
 */
export function vehicleBayLayers(m: Module, def: ModuleDef, s: BayStep): ModuleLayer[] {
  const a = def.asset;
  const out: ModuleLayer[] = [{ chain: [bayId(a, m.rot, s.bay), bayId(a, m.rot, ''), a], key: a, tiles: 'all', strips: true }];
  if (s.shuttle !== null) out.push({ chain: [parkedId(m.rot, s.shuttle), parkedId(m.rot, '')], key: 'vehicle.shuttle.parked', tiles: 'all', strips: true });
  return out;
}
