import { Container, Sprite } from 'pixi.js';
import type { World } from '../sim/ecs';
import { ModuleC } from '../sim/modules/components';
import { hullOutward, hullSide } from '../sim/modules/footprint';
import type { ModuleDef } from '../sim/registry';
import { BodyC, isAirborne } from '../sim/body';
import { ShipC } from '../sim/combat/components';
import { VehicleC, type Vehicle } from '../sim/vehicles/components';
import type { Atlas, StaticSprite } from './assets/loader';
import { Z_PX } from './heights';
import type { Pt } from './iso';
import { UNDOCK_DONE_MS, UNDOCK_SLIDE_AT_MS, dockProgress, undockProgress, type DockProgress } from './dockSequence';
import { BAY_FRAME_MS, LAUNCH_LIFT, RETURN_LAND } from './vehicleBayArt';

/** Altitude (tiles over the deck) of a shuttle in flight and at a dock, and of its belly on the pit floor. */
const CRUISE_Z = 0.4;
const PIT_Z = -0.95;
/**
 * Docked at an airlock the shuttle lies parallel to the hull, side hatch toward it (`vehicle.shuttle.dockside.d<k>`, k = the
 * hull's outward direction). The round hatch is at (HATCH_U along the nose, HATCH_V out from the centre line, axis 1.30 up) on the
 * shuttle's -v flank (shuttle_craft.py / tools/blender/review/TRANSPORT_B.md); the collar's mating face is COLLAR_FACE past the dock
 * point (the collar tile's centre; tools/blender/sprites/airlock.py COLLAR_END) with its axis 0.95 up. So the shuttle's centre lies
 * COLLAR_FACE + HATCH_V + HOLD_OFF out from the dock point and HATCH_U back along the hull, and at DOCK_Z (axis 0.95 = DOCK_Z + 1.30).
 * The tube (`vehicle.shuttle.tube.d<k>.f1..f3`, the same origin as the shuttle sprite) extends from the hatch the HOLD_OFF to the collar face.
 */
const HATCH_U = 1.4;
const HATCH_V = 0.817;
const COLLAR_FACE = 0.2;
const DOCK_Z = 0.95 - 1.3;
/** Half length (along the nose) and half width of the shuttle's footprint in tiles (shuttle_craft.py, wings folded). */
const HALF_LEN = 2.4;
const HALF_W = 1.0;
/** The shuttle holds off this much further from the hull than flush; its docking tube (one fixed length) bridges the gap to the collar. */
const HOLD_OFF = 1.1;
/** After taking off, a shuttle waits LAG ms on the spot (the doors open under it), then catches up with the sim over CATCH ms. */
const CATCH_MS = 1500;
const EIGHTH = Math.PI / 4;

/** What the host is told about a vehicle: its state, its dock airlock and its home ship's grid (the camera ship's bay filter). */
export interface ShuttleRef {
  state: Vehicle['state'];
  dock: number;
  homeGrid: number;
}

export interface ShuttleViewHost {
  /** Where the shuttles are drawn: the air layer, over every tile and roof. The container must sort by zIndex. */
  layer: Container;
  /** Sector position (tiles) to art px in this layer's frame. */
  project(sx: number, sy: number): Pt;
  /** Which vehicles this view draws (flying, docked, and the one just leaving or settling in a bay). */
  include(v: ShuttleRef): boolean;
  /** Vehicle defs another view draws (mining pods). */
  skip?(def: string): boolean;
  /**
   * Where a body at hull height or lower is drawn: the shared world layer (a sector-frame container whose children sort with
   * every region's tiles, walls, modules and crew by depth), so the hull, walls and an airlock's collar sort against the
   * shuttle (it is behind the ship at a far hull, in front at a near one) and anything in front of a bay covers a shuttle
   * lifting out of it. `project` maps sector tiles to its art px; the zIndex is a sector depth (x + y in tiles).
   */
  low: { layer: Container; project(sx: number, sy: number): Pt };
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
  /** The dock pose it is docked in (or leaving), and when the sim docked / undocked it (performance.now(); -Infinity if never). */
  pose: { d: number; dx: number; dy: number } | null;
  /** Drawn in the shared world layer (a low body) rather than the air layer. */
  low: boolean;
  dockedAt: number;
  undockedAt: number;
  /** The docking tube: its sprites and which side of the shuttle sprite they sit on (near hulls: behind it). */
  tube: Container;
  tubeBody: Sprite;
  tubeGlow: Sprite;
  tubeBehind: boolean;
  /** performance.now() of the last launch (stowed to out) and landing (out to stowed); -Infinity if none. */
  launched: number;
  landed: number;
  /** Recent sim positions, for the launch delay. */
  trail: Sample[];
}

/**
 * Depth key (x + y in tiles, as `depthKey`) of the front-most point of a shuttle's footprint centred on sector point (sx, sy).
 * A body in a bay pit uses it (+ 0.5, like an engine bell), so the near lip stays behind it and the rows in front cover it.
 * A docked body keeps its centre's depth: it lies along the hull outside it, and at a far hull (west, north) its front corner
 * would pass the hull walls in front of it.
 */
export function frontDepth(sx: number, sy: number, heading: number): number {
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  return sx + sy - 1 + HALF_LEN * Math.abs(c + s) + HALF_W * Math.abs(c - s);
}

/** Smoothstep 0..1. */
const ease = (k: number): number => {
  const c = Math.max(0, Math.min(1, k));
  return c * c * (3 - 2 * c);
};

/**
 * Draws shuttles (VehicleC entities, placed by their BodyC) with the pipeline sprites in the sector layer: `vehicle.shuttle.fly.d<0..7>` in flight
 * (nearest heading), `vehicle.shuttle.dockside.d<k>` at an airlock (lying along the hull, side hatch against the collar) and
 * `vehicle.shuttle.docked.d<k>` for the lift off the pit floor and the settle back into it, timed to the bay's door frames (vehicleBayArt). A shuttle parked in its bay is the bay's
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

  /** Dock pose: the hull's outward direction index d (0, 2, 4, 6) and the full offset of the shuttle centre from the dock point. */
  function dockPose(v: Vehicle): { d: number; dx: number; dy: number } | null {
    const m = world.get(v.dock, ModuleC);
    const def = m && modules[m.def];
    if (!m || !def) return null;
    const out = hullOutward(hullSide(def, m.rot) ?? 'n');
    const d = headingIndex(Math.atan2(out.y, out.x));
    // The nose points along the hull: (sin d, -cos d) = (out.y, -out.x).
    return {
      d,
      dx: out.x * (COLLAR_FACE + HATCH_V + HOLD_OFF) - out.y * HATCH_U,
      dy: out.y * (COLLAR_FACE + HATCH_V + HOLD_OFF) + out.x * HATCH_U,
    };
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
      for (const id of world.query(VehicleC, BodyC)) {
        const v = world.get(id, VehicleC);
        const b = world.get(id, BodyC);
        if (!v || !b || host.skip?.(v.def)) continue;
        const ref: ShuttleRef = { state: v.state, dock: v.dock, homeGrid: world.has(v.homeShip, ShipC) ? v.homeShip : 0 };
        let t = tracks.get(id);
        if (!t) {
          const root = new Container();
          const body = new Sprite();
          const glow = new Sprite();
          glow.blendMode = 'add';
          const tube = new Container();
          const tubeBody = new Sprite();
          const tubeGlow = new Sprite();
          tubeGlow.blendMode = 'add';
          tube.addChild(tubeBody, tubeGlow);
          tube.visible = false;
          root.addChild(body, glow, tube);
          host.layer.addChild(root);
          t = { root, body, glow, key: '', x: b.x, y: b.y, heading: b.heading, state: v.state, z: CRUISE_Z, pose: null, low: false, dockedAt: -Infinity, undockedAt: -Infinity, tube, tubeBody, tubeGlow, tubeBehind: false, launched: -Infinity, landed: -Infinity, trail: [] };
          tracks.set(id, t);
        }
        if (t.state !== v.state) {
          if (t.state === 'stowed') {
            t.launched = now;
            t.heading = (parkedIndex(bayRot(v)) * EIGHTH);
            t.trail = [];
          } else if (v.state === 'stowed') t.landed = now;
          if (v.state === 'docked') [t.dockedAt, t.undockedAt] = [now, -Infinity];
          else if (t.state === 'docked') [t.undockedAt, t.trail] = [now, []];
          t.state = v.state;
        }
        const sinceLaunch = now - t.launched;
        const sinceLand = now - t.landed;
        const sinceUndock = now - t.undockedAt;
        const undocking = v.state !== 'docked' && v.state !== 'stowed' && !!t.pose && sinceUndock < UNDOCK_DONE_MS + CATCH_MS;
        const launching = v.state !== 'stowed' && sinceLaunch < LAUNCH_LIFT.end * BAY_FRAME_MS + CATCH_MS;
        const landing = v.state === 'stowed' && sinceLand < RETURN_LAND.end * BAY_FRAME_MS;
        const visible = host.include(ref) && (v.state !== 'stowed' ? !(sinceLaunch < LAUNCH_LIFT.start * BAY_FRAME_MS) : landing);
        if (!visible) {
          t.root.visible = false;
          seen.add(id);
          continue;
        }
        t.root.visible = true;
        seen.add(id);

        // Position: the sim's, smoothed; after take-off, held over the pit while the doors open, then catching up.
        const k = 1 - Math.exp(-dt * 14);
        let px = b.x;
        let py = b.y;
        if (launching || undocking) {
          // Held on the spot (over the open pit / alongside the hull) while the bay doors open or the tube retracts, then it
          // catches up with the sim, which has already sent it on its way.
          t.trail.push({ t: now, x: b.x, y: b.y });
          const lag = launching ? LAUNCH_LIFT.start * BAY_FRAME_MS : UNDOCK_SLIDE_AT_MS;
          const since = launching ? sinceLaunch : sinceUndock;
          const delay = lag * (1 - ease((since - lag) / CATCH_MS));
          const at = now - delay;
          while (t.trail.length > 2 && (t.trail[1] as Sample).t <= at) t.trail.shift();
          const a = t.trail[0] as Sample;
          const n = t.trail[1] ?? a;
          const f = n.t > a.t ? Math.max(0, Math.min(1, (at - a.t) / (n.t - a.t))) : 0;
          px = a.x + (n.x - a.x) * f;
          py = a.y + (n.y - a.y) * f;
          [t.x, t.y] = [px, py];
        } else if (Math.hypot(b.x - t.x, b.y - t.y) > 3) [t.x, t.y] = [b.x, b.y];
        else [t.x, t.y] = [t.x + (b.x - t.x) * k, t.y + (b.y - t.y) * k];

        // Heading: smoothed toward the movement heading (docked / docking: parallel to the hull; settling into a bay: its parking
        // heading).
        if (v.state === 'docked') t.pose = dockPose(v) ?? t.pose;
        const prog: DockProgress | null =
          t.pose && v.state === 'docked' ? dockProgress(now - t.dockedAt) : t.pose && undocking ? undockProgress(sinceUndock) : null;
        if (t.pose && !prog && v.state !== 'docked') t.pose = null;
        const target = landing ? parkedIndex(bayRot(v)) * EIGHTH : t.pose && prog && prog.slide > 0.01 ? t.pose.d * EIGHTH - Math.PI / 2 : b.heading;
        const dh = Math.atan2(Math.sin(target - t.heading), Math.cos(target - t.heading));
        t.heading += dh * (1 - Math.exp(-dt * 10));

        let sprite: StaticSprite | undefined;
        let z = CRUISE_Z;
        t.z += (CRUISE_Z - t.z) * (1 - Math.exp(-dt * 5));
        let off = { dx: 0, dy: 0 };
        let thrust = v.dest ? 1 : 0.45;
        let tubeFrame = 0;
        if (t.pose && prog && prog.slide > 0.01) {
          // Docking: the flying shuttle turns parallel to the hull while sliding alongside; half way the folded, legs-up sprite
          // lying along the hull takes over; then the tube extends to the collar. Undocking runs backwards.
          const e = prog.slide;
          sprite = atlas.stat(e >= 0.5 ? `vehicle.shuttle.dockside.d${t.pose.d}` : `vehicle.shuttle.fly.d${headingIndex(t.heading)}`);
          off = { dx: t.pose.dx * e, dy: t.pose.dy * e };
          z = CRUISE_Z + (DOCK_Z - CRUISE_Z) * e;
          thrust = e >= 0.5 ? 0 : v.state === 'docked' ? 0.45 : 1;
          tubeFrame = e >= 0.999 ? prog.tube : 0;
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
        const tubeArt = tubeFrame > 0 && t.pose ? atlas.stat(`vehicle.shuttle.tube.d${t.pose.d}.f${tubeFrame}`) : undefined;
        t.tube.visible = !!tubeArt;
        if (tubeArt && t.pose) {
          t.tubeBody.texture = tubeArt.tex;
          t.tubeBody.position.set(-tubeArt.ax, -tubeArt.ay);
          t.tubeGlow.visible = !!tubeArt.glow;
          if (tubeArt.glow) t.tubeGlow.texture = tubeArt.glow;
          t.tubeGlow.position.set(-tubeArt.ax, -tubeArt.ay);
          // The hatch faces the hull: on a near hull (east / south) that is away from the camera, so the tube is behind the shuttle.
          const behind = t.pose.d === 0 || t.pose.d === 2;
          if (behind !== t.tubeBehind || t.tube.parent !== t.root) {
            t.tubeBehind = behind;
            if (behind) t.root.addChildAt(t.tube, 0);
            else t.root.addChild(t.tube);
          }
        }

        // Depth rule (ARCHITECTURE "Sector grid" §3): an airborne body (above the roofs) is drawn in the air layer, sorted by
        // x + y; one at hull height or lower sorts in the shared world layer. Undocking keeps the world layer while the tube
        // retracts and the shuttle slides out, and the lift out of the bay is low until it reaches cruise (render timing; the sim
        // has it airborne already). The pixel lift still comes from CRUISE_Z / DOCK_Z / PIT_Z: `b.alt` switches with the state
        // and does not ramp, so it cannot drive the art.
        const lifting = launching && sinceLaunch < LAUNCH_LIFT.end * BAY_FRAME_MS;
        t.low = !isAirborne(b) || undocking || lifting;
        const layer = t.low ? host.low.layer : host.layer;
        if (t.root.parent !== layer) layer.addChild(t.root);
        const [sx, sy] = [t.x + off.dx, t.y + off.dy];
        const p = (t.low ? host.low.project : host.project)(sx, sy);
        t.root.position.set(Math.round(p.x), Math.round(p.y - z * Z_PX));
        t.root.zIndex = !t.low ? sx + sy : t.pose ? sx + sy - 1 : frontDepth(sx, sy, t.heading) + 0.5;
      }
      for (const id of [...tracks.keys()]) if (!seen.has(id)) drop(id);
    },
    dispose() {
      for (const id of [...tracks.keys()]) drop(id);
    },
  };
}
