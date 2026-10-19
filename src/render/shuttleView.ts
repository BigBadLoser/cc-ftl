import { Container, Sprite } from 'pixi.js';
import type { World } from '../sim/ecs';
import { ModuleC } from '../sim/modules/components';
import { hullOutward, hullSide } from '../sim/modules/footprint';
import type { ModuleDef } from '../sim/registry';
import { VehicleC, type Vehicle } from '../sim/vehicles/components';
import type { Atlas, StaticSprite } from './assets/loader';
import { Z_PX } from './heights';
import type { Pt } from './iso';
import { BAY_FRAME_MS, LAUNCH_LIFT, RETURN_LAND } from './vehicleBayArt';

/** Altitude (tiles over the deck) of a shuttle in flight and at a dock, and of its belly on the pit floor. */
const CRUISE_Z = 0.4;
const PIT_Z = -0.95;
/** Altitude at a dock: the shuttle settles to the deck so its rear ramp meets the collar's hatch (axis 0.95 up). */
const DOCK_Z = 0;
/**
 * The docked shuttle's centre lies this far beyond the dock point (sector tiles). The dock point is the centre of the airlock's
 * collar tile; the collar's mating face is 0.2 past it (tools/blender/sprites/airlock.py COLLAR_END), and the transport shuttle's
 * rear ramp is 1.95 behind its centre (shuttle_craft.py transport_shuttle), so the ramp meets the collar's hatch.
 */
const DOCK_REACH = 2.15;
/** After taking off, a shuttle waits LAG ms on the spot (the doors open under it), then catches up with the sim over CATCH ms. */
const CATCH_MS = 1500;
const EIGHTH = Math.PI / 4;

export interface ShuttleViewHost {
  /** Where the shuttles are drawn. The container must sort by zIndex. */
  layer: Container;
  /** Sector position (tiles) to art px in this layer's frame. */
  project(sx: number, sy: number): Pt;
  /** Which vehicles this view draws (flying, docked, and the one just leaving or settling in a bay). */
  include(v: Vehicle): boolean;
  /**
   * Where a docked vehicle is drawn: its airlock ship's own sorted layer, in that ship's frame, so the hull, walls and the
   * airlock's collar sort against the shuttle by depth (it is behind the ship at a far hull, in front at a near one).
   * `project` maps sector tiles to that layer's art px, `depth` gives the zIndex. Null: the sector layer.
   */
  dock?(v: Vehicle): { layer: Container; project(sx: number, sy: number): Pt; depth(sx: number, sy: number): number } | null;
}

export interface ShuttleView {
  /** Per frame: follow the sim (smoothly), create and remove sprites. Reads the sim only. */
  update(dt: number): void;
  dispose(): void;
}

/** Index 0..7 of the sprite heading nearest to a heading in radians (d0 = +x, d2 = +y, turning clockwise on screen). */
export const headingIndex = (h: number): number => (((Math.round(h / EIGHTH) % 8) + 8) % 8);

/** Heading index of the cardinal a shuttle parks with in a bay of rotation `rot` (nose +y at r0, a quarter turn per rotation). */
export const parkedIndex = (rot: number): number => (2 + 2 * rot) % 8;

interface Sample {
  t: number;
  x: number;
  y: number;
}
interface Track {
  root: Container;
  body: Sprite;
  glow: Sprite;
  key: string;
  x: number;
  y: number;
  heading: number;
  state: Vehicle['state'];
  /** Eased altitude for flying and docked (settles when it docks, rises when it leaves). */
  z: number;
  /** performance.now() of the last launch (stowed to out) and landing (out to stowed); -Infinity if none. */
  launched: number;
  landed: number;
  /** Recent sim positions, for the launch delay. */
  trail: Sample[];
}

/** Smoothstep 0..1. */
const ease = (k: number): number => {
  const c = Math.max(0, Math.min(1, k));
  return c * c * (3 - 2 * c);
};

/**
 * Draws shuttles (VehicleC entities) with the pipeline sprites in the sector layer: `vehicle.shuttle.fly.d<0..7>` in flight
 * (nearest heading), `vehicle.shuttle.docked.d<k>` at an airlock (nose out, rear against the door) and for the lift off the pit
 * floor and the settle back into it, timed to the bay's door frames (vehicleBayArt). A shuttle parked in its bay is the bay's
 * own layer. Renderer only; it never writes the sim.
 */
export function createShuttleView(world: World, atlas: Atlas, modules: Readonly<Record<string, ModuleDef>>, host: ShuttleViewHost): ShuttleView {
  const tracks = new Map<number, Track>();

  function drop(id: number): void {
    const t = tracks.get(id);
    if (!t) return;
    if (!t.root.destroyed) t.root.destroy({ children: true });
    tracks.delete(id);
  }

  const bayRot = (v: Vehicle): number => world.get(v.home, ModuleC)?.rot ?? 0;

  /** Dock pose: heading index (nose out) and the offset of the shuttle centre from the dock point. */
  function dockPose(v: Vehicle): { d: number; dx: number; dy: number } | null {
    const m = world.get(v.dock, ModuleC);
    const def = m && modules[m.def];
    if (!m || !def) return null;
    const out = hullOutward(hullSide(def, m.rot) ?? 'n');
    return { d: headingIndex(Math.atan2(out.y, out.x)), dx: out.x * DOCK_REACH, dy: out.y * DOCK_REACH };
  }

  function show(t: Track, sprite: StaticSprite | undefined, glowAlpha: number): boolean {
    if (!sprite) return false;
    const id = sprite.tex.uid;
    if (t.key !== String(id)) {
      t.key = String(id);
      t.body.texture = sprite.tex;
      if (sprite.glow) t.glow.texture = sprite.glow;
    }
    t.body.position.set(-sprite.ax, -sprite.ay);
    t.glow.position.set(-sprite.ax, -sprite.ay);
    t.glow.visible = !!sprite.glow;
    t.glow.alpha = glowAlpha;
    return true;
  }

  return {
    update(dt) {
      const now = performance.now();
      const seen = new Set<number>();
      for (const id of world.query(VehicleC)) {
        const v = world.get(id, VehicleC);
        if (!v) continue;
        let t = tracks.get(id);
        if (!t) {
          const root = new Container();
          const body = new Sprite();
          const glow = new Sprite();
          glow.blendMode = 'add';
          root.addChild(body, glow);
          host.layer.addChild(root);
          t = { root, body, glow, key: '', x: v.x, y: v.y, heading: v.heading, state: v.state, z: CRUISE_Z, launched: -Infinity, landed: -Infinity, trail: [] };
          tracks.set(id, t);
        }
        if (t.state !== v.state) {
          if (t.state === 'stowed') {
            t.launched = now;
            t.heading = (parkedIndex(bayRot(v)) * EIGHTH);
            t.trail = [];
          } else if (v.state === 'stowed') t.landed = now;
          t.state = v.state;
        }
        const sinceLaunch = now - t.launched;
        const sinceLand = now - t.landed;
        const launching = v.state !== 'stowed' && sinceLaunch < LAUNCH_LIFT.end * BAY_FRAME_MS + CATCH_MS;
        const landing = v.state === 'stowed' && sinceLand < RETURN_LAND.end * BAY_FRAME_MS;
        const visible = host.include(v) && (v.state !== 'stowed' ? !(sinceLaunch < LAUNCH_LIFT.start * BAY_FRAME_MS) : landing);
        if (!visible) {
          t.root.visible = false;
          seen.add(id);
          continue;
        }
        t.root.visible = true;
        seen.add(id);

        // Position: the sim's, smoothed; after take-off, held over the pit while the doors open, then catching up.
        const k = 1 - Math.exp(-dt * 14);
        let px = v.x;
        let py = v.y;
        if (launching) {
          t.trail.push({ t: now, x: v.x, y: v.y });
          const lag = LAUNCH_LIFT.start * BAY_FRAME_MS;
          const delay = lag * (1 - ease((sinceLaunch - lag) / CATCH_MS));
          const at = now - delay;
          while (t.trail.length > 2 && (t.trail[1] as Sample).t <= at) t.trail.shift();
          const a = t.trail[0] as Sample;
          const b = t.trail[1] ?? a;
          const f = b.t > a.t ? Math.max(0, Math.min(1, (at - a.t) / (b.t - a.t))) : 0;
          px = a.x + (b.x - a.x) * f;
          py = a.y + (b.y - a.y) * f;
          [t.x, t.y] = [px, py];
        } else if (Math.hypot(v.x - t.x, v.y - t.y) > 3) [t.x, t.y] = [v.x, v.y];
        else [t.x, t.y] = [t.x + (v.x - t.x) * k, t.y + (v.y - t.y) * k];

        // Heading: smoothed toward the movement heading (or, settling into a bay, toward its parking heading).
        const target = landing ? parkedIndex(bayRot(v)) * EIGHTH : v.heading;
        const dh = Math.atan2(Math.sin(target - t.heading), Math.cos(target - t.heading));
        t.heading += dh * (1 - Math.exp(-dt * 10));

        let sprite: StaticSprite | undefined;
        let z = CRUISE_Z;
        t.z += ((v.state === 'docked' ? DOCK_Z : CRUISE_Z) - t.z) * (1 - Math.exp(-dt * 5));
        let off = { dx: 0, dy: 0 };
        let thrust = v.dest ? 1 : 0.45;
        if (v.state === 'docked') {
          const pose = dockPose(v);
          if (pose) {
            sprite = atlas.stat(`vehicle.shuttle.docked.d${pose.d}`);
            off = pose;
          }
          z = t.z;
          thrust = 0;
        } else if (launching && sinceLaunch < (LAUNCH_LIFT.end * BAY_FRAME_MS)) {
          // Lifting off the pit floor in the parked pose (legs up, wings folded), then spreading the wings at altitude.
          const f = ease((sinceLaunch - LAUNCH_LIFT.start * BAY_FRAME_MS) / ((LAUNCH_LIFT.end - LAUNCH_LIFT.start) * BAY_FRAME_MS));
          z = PIT_Z + (CRUISE_Z - PIT_Z) * f;
          sprite = atlas.stat(`vehicle.shuttle.docked.d${parkedIndex(bayRot(v))}`);
          thrust = 0;
        } else if (landing) {
          const f = ease((sinceLand - RETURN_LAND.start * BAY_FRAME_MS) / ((RETURN_LAND.end - RETURN_LAND.start - 2) * BAY_FRAME_MS));
          z = CRUISE_Z + (PIT_Z - CRUISE_Z) * f;
          sprite = f > 0 ? atlas.stat(`vehicle.shuttle.docked.d${parkedIndex(bayRot(v))}`) : atlas.stat(`vehicle.shuttle.fly.d${headingIndex(t.heading)}`);
          thrust = f > 0 ? 0 : 0.45;
        } else {
          sprite = atlas.stat(`vehicle.shuttle.fly.d${headingIndex(t.heading)}`);
          z = t.z;
        }
        if (!show(t, sprite, thrust === 0 ? 0 : 0.55 + 0.45 * thrust)) t.root.visible = false;

        const slot = v.state === 'docked' ? host.dock?.(v) ?? null : null;
        const layer = slot?.layer ?? host.layer;
        if (t.root.parent !== layer) layer.addChild(t.root);
        const p = (slot?.project ?? host.project)(t.x + off.dx, t.y + off.dy);
        t.root.position.set(Math.round(p.x), Math.round(p.y - z * Z_PX));
        t.root.zIndex = slot ? slot.depth(t.x + off.dx, t.y + off.dy) : t.x + t.y;
      }
      for (const id of [...tracks.keys()]) if (!seen.has(id)) drop(id);
    },
    dispose() {
      for (const id of [...tracks.keys()]) drop(id);
    },
  };
}
