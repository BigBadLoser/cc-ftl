import { Container, Sprite } from 'pixi.js';
import { batchAdditive } from './batch';
import { animNow } from './animClock';
import type { World } from '../sim/ecs';
import { ModuleC } from '../sim/modules/components';
import { hullOutward, hullSide } from '../sim/modules/footprint';
import type { ModuleDef } from '../sim/registry';
import { BodyC, isAirborne } from '../sim/body';
import { ShipC } from '../sim/combat/components';
import { PAD_NOSE, isLandingPad, padOfAirlock } from '../sim/modules/landingPad';
import { CrewC, PositionC } from '../sim/crew/components';
import { EmbarkOrderC, VehicleBayC, VehicleC, type Vehicle } from '../sim/vehicles/components';
import type { Atlas, StaticSprite } from './assets/loader';
import { Z_PX } from './heights';
import type { Pt } from './iso';
import { UNDOCK_DONE_MS, UNDOCK_SLIDE_AT_MS, dockProgress, undockProgress, type DockProgress } from './dockSequence';
import { BAY_FRAME_MS, CATCH_MS, FLOOR_EXIT, createBayClip, createBayTrack, ease, hullDepth, type BayTrack } from './vehicleBayArt';

/** Altitude (tiles over the deck) of a shuttle in flight and at a dock, and of its belly on the pit floor. */
const CRUISE_Z = 0.4;
/**
 * The landing gear on a pad (#509), render timing only: a take-off plays the gear up (f4 to f0) over `gearMs` while the shuttle lifts to
 * cruise over `liftMs`; a landing starts the gear down and the descent `range` tiles out from the pad centre (f0 to f4, down before touchdown).
 * The rear ramp (r1 to r4) opens over `rampMs` when crew are ordered aboard or stand within `rampReach` tiles of the ramp's foot, and closes
 * `rampHoldMs` after the last of them has gone.
 */
const PAD_GEAR = { liftMs: 1600, gearMs: 1100, range: 5, rampMs: 900, rampHoldMs: 900, rampReach: 3.5 };
const PIT_Z = -0.95;
/**
 * Docked at an airlock the shuttle lies parallel to the hull, side hatch toward it (`vehicle.shuttle.dockside.d<k>`, k = the
 * hull's outward direction). The round hatch is at (HATCH_U along the nose, HATCH_V out from the centre line, axis 1.30 up) on the
 * shuttle's -v flank (shuttle_craft.py / tools/blender/review/TRANSPORT_B.md); the collar's mating face is COLLAR_FACE past the dock
 * point (the collar tile's centre; tools/blender/sprites/airlock.py COLLAR_END) with its axis COLLAR_Z up (airlock.py ZC). So the
 * shuttle's centre lies COLLAR_FACE + HATCH_V + HOLD_OFF out from the dock point and HATCH_U back along the hull, and at DOCK_Z
 * (COLLAR_Z = DOCK_Z + 1.30).
 * The tube (`vehicle.shuttle.tube.d<k>.f1..f3`, the same origin as the shuttle sprite) extends from the hatch the HOLD_OFF to the collar face.
 */
const HATCH_U = 1.4;
const HATCH_V = 0.817;
const COLLAR_FACE = 0.2;
/** The collar's axis height (airlock.py ZC). */
const COLLAR_Z = 0.539;
const DOCK_Z = COLLAR_Z - 1.3;
/** Half length (along the nose) and half width of the shuttle's footprint in tiles (shuttle_craft.py, wings folded). */
const HALF_LEN = 2.4;
const HALF_W = 1.0;
/** The shuttle holds off this much further from the hull than flush; its docking tube (one fixed length) bridges the gap to the collar. */
const HOLD_OFF = 1.1;
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
  /** The ship whose tiles hold a sector tile (0: none): which ship's pad an airlock opens onto (`padOfAirlock`). */
  shipOf(t: { x: number; y: number }): number;
}

export interface ShuttleView {
  /** Per frame: follow the sim (smoothly), create and remove sprites. Reads the sim only. */
  update(dt: number): void;
  /** The shuttle (vehicle entity) drawn under an art point of the layer frame, front-most first, or null. Its sprite's ellipse, not the corners. */
  pick(ax: number, ay: number): number | null;
  dispose(): void;
}

/** Index 0..7 of the sprite heading nearest to a heading in radians (d0 = +x, d2 = +y, turning clockwise on screen). */
export const headingIndex = (h: number): number => (((Math.round(h / EIGHTH) % 8) + 8) % 8);

/** Heading index of the cardinal a shuttle parks with in a bay of rotation `rot` (nose +y at r0, a quarter turn per rotation). */
export const parkedIndex = (rot: number): number => (2 + 2 * rot) % 8;

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
  /** The launch / landing clock and position trail of the bay handoff (vehicleBayArt). */
  bay: BayTrack;
  /** Hides it below the pit's deck or the hull's edge while it goes through the floor doors. */
  clip: ReturnType<typeof createBayClip>;
  /** Last seen sitting on a landing pad: its take-off has no bay doors to wait for. */
  padded: boolean;
  /** The rotation of the pad it last stood on (its take-off turns from it). */
  padRot: number;
  /** Rear ramp of a shuttle on a pad: 0 shut to 1 open, and when crew were last about it. */
  ramp: number;
  rampBusy: number;
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
  /** The landing pad a shuttle sits on (#509), stowed there or landed beside its airlock: drawn parked in the open, no bay doors to wait for. */
  const padUnder = (v: Vehicle, b: { x: number; y: number }): { x: number; y: number; rot: number } | null => {
    if (v.state === 'flying') return null;
    if (v.state === 'stowed') { const m = world.get(v.home, ModuleC); return m && isLandingPad(modules[m.def]) ? m : null; }
    return padAt(b.x, b.y);
  };
  /** The landing pad whose footprint holds a sector point, if any. */
  const padAt = (x: number, y: number): { x: number; y: number; rot: number } | null => {
    for (const id of world.query(VehicleBayC, ModuleC)) {
      const m = world.get(id, ModuleC), def = m && modules[m.def];
      if (m && isLandingPad(def) && x > m.x && y > m.y && x < m.x + 9 && y < m.y + 9) return m;
    }
    return null;
  };
  /** The pad a flying shuttle is heading for (home bay, or the airlock it is to dock at), if it is one. */
  const padTarget = (v: Vehicle): { x: number; y: number; rot: number } | null => {
    if (v.dest?.type === 'bay') { const m = world.get(v.home, ModuleC); return m && isLandingPad(modules[m.def]) ? m : null; }
    if (v.dest?.type === 'dock') {
      const id = padOfAirlock(world, modules, host.shipOf, v.dest.airlock);
      return id ? world.get(id, ModuleC) ?? null : null;
    }
    return null;
  };

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
      const now = animNow();
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
          batchAdditive(glow);
          const tube = new Container();
          const tubeBody = new Sprite();
          const tubeGlow = new Sprite();
          batchAdditive(tubeGlow);
          tube.addChild(tubeBody, tubeGlow);
          tube.visible = false;
          root.addChild(body, glow, tube);
          host.layer.addChild(root);
          t = { root, body, glow, key: '', x: b.x, y: b.y, heading: b.heading, state: v.state, z: CRUISE_Z, pose: null, low: false, dockedAt: -Infinity, undockedAt: -Infinity, tube, tubeBody, tubeGlow, tubeBehind: false, bay: createBayTrack(v.state), clip: createBayClip(root), padded: false, padRot: 0, ramp: 0, rampBusy: -Infinity };
          tracks.set(id, t);
        }
        if (t.state !== v.state) {
          if (t.state === 'stowed') {
            t.heading = (parkedIndex(bayRot(v)) * EIGHTH);
          }
          t.bay.update(v.state, now, b.x, b.y);
          if (v.state === 'docked') [t.dockedAt, t.undockedAt] = [now, -Infinity];
          else if (t.state === 'docked' && t.padded) {
            // Off a landing pad (#509): the pad take-off (gear up, lift), never the collar's undock.
            [t.heading, t.pose] = [parkedIndex(t.padRot) * EIGHTH, null];
            t.bay.restart(now);
          } else if (t.state === 'docked') {
            t.undockedAt = now;
            t.bay.clearTrail();
          }
          t.state = v.state;
        }
        const sinceUndock = now - t.undockedAt;
        const undocking = v.state !== 'docked' && v.state !== 'stowed' && !!t.pose && sinceUndock < UNDOCK_DONE_MS + CATCH_MS;
        const padOn = padUnder(v, b), pad = !!padOn;
        if (v.state !== 'flying') t.padded = pad;
        if (padOn) t.padRot = padOn.rot;
        const hand = t.bay.pose(v.state, now, { padded: t.padded, depth: hullDepth(world, v, b), homing: v.dest?.type === 'bay' });
        const { launching, landing, sinceLaunch } = hand;
        // Gear phase of a pad take-off or landing: the sprite frame (0 up to 4 down) and the height.
        let gear: { frame: number; z: number; rot: number } | null = null;
        if (v.state === 'flying') {
          const to = padTarget(v);
          if (t.padded && sinceLaunch < PAD_GEAR.liftMs) gear = { frame: 4 - Math.round(4 * ease(sinceLaunch / PAD_GEAR.gearMs)), z: CRUISE_Z * ease(sinceLaunch / PAD_GEAR.liftMs), rot: t.padRot };
          else if (to && Math.hypot(to.x + 4.5 - b.x, to.y + 4.5 - b.y) < PAD_GEAR.range) {
            const d = Math.hypot(to.x + 4.5 - b.x, to.y + 4.5 - b.y) / PAD_GEAR.range;
            gear = { frame: Math.round(4 * ease(Math.min(1, (1 - d) * 1.6))), z: CRUISE_Z * ease(d), rot: to.rot };
          }
        }
        const visible = (pad || !!gear || host.include(ref)) && (pad || hand.drawn);
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
        if (hand.hold) {
          // Sinking through the pit's doors: over the pit it left from, while the sim has flown it on.
          [px, py] = [hand.hold.x, hand.hold.y];
          [t.x, t.y] = [px, py];
        } else if (launching || undocking) {
          // Held on the spot (over the open pit / alongside the hull) while the bay doors open or the tube retracts, then it
          // catches up with the sim, which has already sent it on its way.
          const lag = launching ? 0 : UNDOCK_SLIDE_AT_MS;
          ({ x: px, y: py } = t.bay.delayed(now, b.x, b.y, lag, launching ? sinceLaunch : sinceUndock));
          [t.x, t.y] = [px, py];
        } else if (Math.hypot(b.x - t.x, b.y - t.y) > 3) [t.x, t.y] = [b.x, b.y];
        else [t.x, t.y] = [t.x + (b.x - t.x) * k, t.y + (b.y - t.y) * k];

        // Heading: smoothed toward the movement heading (docked / docking: parallel to the hull; settling into a bay: its parking
        // heading).
        if (v.state === 'docked') t.pose = dockPose(v) ?? t.pose;
        const prog: DockProgress | null =
          t.pose && v.state === 'docked' ? dockProgress(now - t.dockedAt) : t.pose && undocking ? undockProgress(sinceUndock) : null;
        if (t.pose && !prog && v.state !== 'docked') t.pose = null;
        const target = gear ? parkedIndex(gear.rot) * EIGHTH : padOn ? parkedIndex(padOn.rot) * EIGHTH : landing ? parkedIndex(bayRot(v)) * EIGHTH : t.pose && prog && prog.slide > 0.01 ? t.pose.d * EIGHTH - Math.PI / 2 : b.heading;
        const dh = Math.atan2(Math.sin(target - t.heading), Math.cos(target - t.heading));
        t.heading += dh * (1 - Math.exp(-dt * 10));

        let sprite: StaticSprite | undefined;
        let z = CRUISE_Z;
        t.z += (CRUISE_Z - t.z) * (1 - Math.exp(-dt * 5));
        let off = { dx: 0, dy: 0 };
        let thrust = v.dest ? 1 : 0.45;
        let tubeFrame = 0;
        if (padOn) {
          // Parked in the open on a landing pad: standing on its gear, on the ground (the pad's deck is baked into the sprite).
          // Crew ordered aboard, or about the ramp's foot (behind the tail), have it open; it shuts a while after the last has gone.
          const [nx, ny] = PAD_NOSE[((padOn.rot % 4) + 4) % 4] as readonly [number, number];
          const foot = { x: padOn.x + 4.5 - nx * 4.5, y: padOn.y + 4.5 - ny * 4.5 };
          let busy = false;
          for (const c of world.query(EmbarkOrderC)) if (world.get(c, EmbarkOrderC)?.vehicle === id) busy = true;
          if (!busy) for (const c of world.query(CrewC, PositionC)) { const q = world.get(c, PositionC)!; if (Math.hypot(q.x + 0.5 - foot.x, q.y + 0.5 - foot.y) < PAD_GEAR.rampReach) { busy = true; break; } }
          if (busy) t.rampBusy = now;
          const want = now - t.rampBusy < PAD_GEAR.rampHoldMs ? 1 : 0;
          t.ramp = Math.max(0, Math.min(1, t.ramp + (want ? 1 : -1) * dt * 1000 / PAD_GEAR.rampMs));
          const art = `vehicle.shuttle.pad.d${parkedIndex(padOn.rot)}`;
          sprite = (t.ramp > 0 ? atlas.stat(`${art}.r${Math.max(1, Math.ceil(t.ramp * 4))}`) : undefined) ?? atlas.stat(`${art}.f4`);
          z = 0;
          thrust = 0;
          t.z = CRUISE_Z;
        } else if (gear) {
          sprite = atlas.stat(`vehicle.shuttle.pad.d${parkedIndex(gear.rot)}.f${gear.frame}`);
          z = gear.z;
          thrust = 0.3;
          t.z = CRUISE_Z;
        } else if (t.pose && prog && prog.slide > 0.01) {
          // Docking: the flying shuttle turns parallel to the hull while sliding alongside; half way the folded, legs-up sprite
          // lying along the hull takes over; then the tube extends to the collar. Undocking runs backwards.
          const e = prog.slide;
          sprite = atlas.stat(e >= 0.5 ? `vehicle.shuttle.dockside.d${t.pose.d}` : `vehicle.shuttle.fly.d${headingIndex(t.heading)}`);
          off = { dx: t.pose.dx * e, dy: t.pose.dy * e };
          z = CRUISE_Z + (DOCK_Z - CRUISE_Z) * e;
          thrust = e >= 0.5 ? 0 : v.state === 'docked' ? 0.45 : 1;
          tubeFrame = e >= 0.999 ? prog.tube : 0;
        } else if (v.state !== 'stowed' && hand.lift !== null) {
          // Lifting off the pit floor in the parked pose (legs up, wings folded), then spreading the wings at altitude.
          z = PIT_Z + (CRUISE_Z - PIT_Z) * hand.lift;
          sprite = atlas.stat(`vehicle.shuttle.docked.d${parkedIndex(bayRot(v))}`);
          thrust = 0;
        } else if (landing && !pad && hand.lift !== null) {
          const f = 1 - hand.lift;
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
        const lifting = launching && sinceLaunch < FLOOR_EXIT.up * BAY_FRAME_MS;
        t.low = !isAirborne(b) || undocking || lifting || !!gear || !!hand.clip;
        const layer = t.low ? host.low.layer : host.layer;
        if (t.root.parent !== layer) layer.addChild(t.root);
        const [sx, sy] = [t.x + off.dx, t.y + off.dy];
        const p = (t.low ? host.low.project : host.project)(sx, sy);
        t.root.position.set(Math.round(p.x), Math.round(p.y - z * Z_PX));
        t.clip.set(hand.clip && !gear && !pad ? z * Z_PX : null);
        t.root.zIndex = pad || gear ? sx + sy + 8.6 : !t.low ? sx + sy : t.pose ? sx + sy - 1 : frontDepth(sx, sy, t.heading) + 0.5;
      }
      for (const id of [...tracks.keys()]) if (!seen.has(id)) drop(id);
    },
    pick(ax, ay) {
      let best: number | null = null;
      let bestZ = -Infinity;
      for (const [id, t] of tracks) {
        if (!t.root.visible || t.root.destroyed || !t.body.texture) continue;
        const w = t.body.texture.width;
        const h = t.body.texture.height;
        const cx = t.root.x + t.body.x + w / 2;
        const cy = t.root.y + t.body.y + h / 2;
        const nx = (ax - cx) / (w / 2);
        const ny = (ay - cy) / (h / 2);
        if (nx * nx + ny * ny <= 1 && t.root.zIndex > bestZ) {
          best = id;
          bestZ = t.root.zIndex;
        }
      }
      return best;
    },
    dispose() {
      for (const id of [...tracks.keys()]) drop(id);
    },
  };
}
