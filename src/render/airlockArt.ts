import type { World } from '../sim/ecs';
import type { Module } from '../sim/modules/components';
import { hullOutward, hullSide } from '../sim/modules/footprint';
import { airlockTiles } from '../sim/portals/airlock';
import type { ModuleDef } from '../sim/registry';
import { TICK_HZ } from '../sim/time';
import { cargoCount } from '../sim/vehicles/cargo';
import { VehicleC } from '../sim/vehicles/components';
import { AirlockC, type Airlock } from '../sim/portals/components';
import type { ModuleLayer } from './moduleArt';
import { DOCK_CLAMP_DELAY_MS } from './dockSequence';
import { BAY_FRAME_MS } from './vehicleBayArt';
import type { WallLevel } from './tiles';

/**
 * The docking airlock's art (tools/blender/sprites/airlock.py): every part is a 1x1 sprite anchored at its own tile, so it
 * sorts against the crew by that tile. Never cut away: only the hull block follows the wall view level (`hull.r{n}.{up,cut,low}`),
 * the pod, unloaders and collar are drawn whole at every level.
 *
 *  - housing `.closed|.f1|.f2|.open` on the pod tile (the inner door), light `.red|.green` over it
 *  - hull block on the hull tile (replaces the door the wall renderer would draw there)
 *  - collar `.closed|.f1|.f2|.open[.docked]` one tile past the hull, sorted like an engine bell (the iris hatch, the outer door)
 *  - unloader `.back` and `.front[.loaded]` on the two body tiles of each unloader, `keepout` on the tile in front of a chute,
 *    `walk` marks on the two tiles in front of the pod (deck marks, under the crew)
 */

export type DoorFrame = 'closed' | 'f1' | 'f2' | 'open';
const OPENING: readonly DoorFrame[] = ['f1', 'f2'];
const CLOSING: readonly DoorFrame[] = ['f2', 'f1'];

/** Share of a cycle spent closing the old door, then (after the pump) opening the new one. */
const DOOR_SHARE = 0.25;

/** The pod's inner door and the collar's outer hatch for an airlock state (`progress` 0..1 through a cycle). */
export function doorFrames(a: Pick<Airlock, 'state'>, progress: number): { inner: DoorFrame; outer: DoorFrame } {
  const frame = (seq: readonly DoorFrame[], u: number): DoorFrame => seq[Math.min(seq.length - 1, Math.floor(u * seq.length))] as DoorFrame;
  switch (a.state) {
    case 'inner':
      return { inner: 'open', outer: 'closed' };
    case 'outer':
      return { inner: 'closed', outer: 'open' };
    case 'toOuter': // inner closes first, the pump runs with both shut, then the outer hatch opens
      return {
        inner: progress < DOOR_SHARE ? frame(CLOSING, progress / DOOR_SHARE) : 'closed',
        outer: progress > 1 - DOOR_SHARE ? frame(OPENING, (progress - (1 - DOOR_SHARE)) / DOOR_SHARE) : 'closed',
      };
    default: // toInner: the outer hatch closes, the pump runs, the inner door opens
      return {
        inner: progress > 1 - DOOR_SHARE ? frame(OPENING, (progress - (1 - DOOR_SHARE)) / DOOR_SHARE) : 'closed',
        outer: progress < DOOR_SHARE ? frame(CLOSING, progress / DOOR_SHARE) : 'closed',
      };
  }
}

/** The collar sequence a shuttle docking or leaving plays (render only; the sim docks instantly). */
const DOCK_SEQ: readonly { frame: DoorFrame; docked: boolean }[] = [
  { frame: 'closed', docked: true }, { frame: 'f1', docked: true }, { frame: 'f2', docked: true },
];
const UNDOCK_SEQ: readonly { frame: DoorFrame; docked: boolean }[] = [
  { frame: 'open', docked: true }, { frame: 'f2', docked: false }, { frame: 'f1', docked: false },
];

type CollarStep = { frame: DoorFrame; docked: boolean };
interface Track {
  docked: boolean;
  anim: { seq: readonly CollarStep[]; start: number } | null;
}

/** Remembers each airlock's docked state between frames and plays the collar sequence when a shuttle docks or undocks. */
export function createCollarAnimator(): { stepOf(airlock: number, docked: boolean, now: number): CollarStep | null; forget(airlock: number): void } {
  const tracks = new Map<number, Track>();
  return {
    /** The collar's docked-sequence frame, or null when the collar follows the airlock's own state. */
    stepOf(airlock, docked, now) {
      let t = tracks.get(airlock);
      if (!t) tracks.set(airlock, (t = { docked, anim: null }));
      if (t.docked !== docked) {
        t.anim = { seq: docked ? DOCK_SEQ : UNDOCK_SEQ, start: docked ? now + DOCK_CLAMP_DELAY_MS : now };  // the collar clamps once the tube has mated
        t.docked = docked;
      }
      if (t.anim) {
        if (now < t.anim.start) return null;
        const s = t.anim.seq[Math.floor((now - t.anim.start) / BAY_FRAME_MS)];
        if (s) return s;
        t.anim = null;
      }
      return docked ? { frame: 'open', docked: true } : null;
    },
    forget(airlock) {
      tracks.delete(airlock);
    },
  };
}

/** The vehicle docked at this airlock, if any. */
export function dockedAt(world: World, airlock: number): number {
  for (const id of world.query(VehicleC)) {
    const v = world.get(id, VehicleC);
    if (v?.state === 'docked' && v.dock === airlock) return id;
  }
  return 0;
}

export interface AirlockView {
  level: WallLevel;
  roofed: boolean;
  collar: CollarStep | null;
}

/**
 * Sprite layers of a docking airlock (a def with `airlock.layout`), bottom first. Under a roof only the hull block and the
 * collar show (the pod and unloaders are inside).
 */
export function airlockLayers(world: World, id: number, m: Module, def: ModuleDef, view: AirlockView): ModuleLayer[] {
  const a = world.get(id, AirlockC);
  const t = airlockTiles(def, m);
  if (!a || !t.collar) return [];
  const a_ = def.asset;
  const r = `.r${m.rot}`;
  const total = Math.max(1, Math.round(def.airlock!.cycleSec * TICK_HZ));
  const cycling = a.state === 'toOuter' || a.state === 'toInner';
  const frames = doorFrames(a, cycling ? 1 - a.timer / total : 0);
  const docked = dockedAt(world, id);
  const cargo = docked ? cargoCount(world.get(docked, VehicleC)!) : 0;
  const collar = view.collar ?? { frame: frames.outer, docked: false };
  const out = hullOutward(hullSide(def, m.rot) ?? 'n');
  // Asset ids put the rotation before the state: module.airlock.housing.r0.open.
  const part = (stem: string, state: string | null, at: { x: number; y: number }, extra: Partial<ModuleLayer> = {}): ModuleLayer =>
    ({ chain: [`${a_}.${stem}${r}${state ? `.${state}` : ''}`], key: `${a_}.${stem}`, tiles: 'all', at, ...extra });

  const out_: ModuleLayer[] = [];
  // Deck marks first (flat, under the crew): the walk zone in front of the pod, the keep-out squares in front of the chutes.
  for (const w of [t.inside, { x: t.inside.x - out.x, y: t.inside.y - out.y }]) out_.push(part('walk', null, w, { flat: true }));
  for (const u of t.unloaders) out_.push(part('keepout', null, u.stand, { flat: true }));
  // Unloaders: the back half, and the front half with the chute (a crate sits on its rollers while the hold is unloaded).
  t.unloaders.forEach((u, i) => {
    const [back, front] = [u.tiles[0], u.tiles[1]];
    if (back) out_.push(part('unloader', 'back', back));
    if (front) out_.push(part('unloader', cargo > i ? 'front.loaded' : 'front', front));
  });
  out_.push(part('housing', frames.inner, t.inner));
  const working = m.enabled && m.hp > 0 && m.powered;
  out_.push(part('light', working && !cycling ? 'green' : 'red', t.inner, { dz: 0.01 }));
  out_.push(part('hull', view.roofed ? 'up' : view.level, t.outer, { tiles: 'hull', roofVisible: true }));
  out_.push(part('collar', `${collar.frame}${collar.docked ? '.docked' : ''}`, t.collar, { out: true, roofVisible: true }));
  return out_;
}
