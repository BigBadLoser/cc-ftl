import { Container, Graphics, Sprite } from 'pixi.js';
import { BodyC } from '../sim/body';
import type { World } from '../sim/ecs';
import { MiningPodC } from '../sim/mining/components';
import { VehicleC } from '../sim/vehicles/components';
import type { Atlas, StaticSprite } from './assets/loader';
import { POD_HOVER_Z } from '../sim/mining/geometry';
import { Z_PX } from './heights';
import { TILE_H } from './iso';
import { sectorArt } from './sectorPos';
import { barrel, beamEnd, HIDDEN } from './podMuzzle';
import { headingIndex } from './shuttleView';

/**
 * Mining pods (VehicleC with a pod def, placed by their BodyC) drawn with the pipeline sprites: `vehicle.mining_pod.fly.d<0..7>`
 * in flight, `.mine.d<k>.f<0|1>` (a two-frame hover loop) while the laser works, and in the bay `.docked.d<k>` (only until the bay
 * layer draws `vehicle.mining_pod.parked.r<r>` itself, see vehicleBayArt; then a stowed pod is not drawn here). The sprites'
 * origin is the pod's centre with the bell's foot at z 0, so the hover is added here: in flight it hovers beside the ore it
 * cuts, facing it (the sim picks the spot and heading, MiningPod.spot), its foot a little under the rock's top. A soft ground shadow and the pulsing mining laser are effects
 * drawn in code. Reads the sim only.
 */
export interface PodView {
  update(dt: number): void;
  dispose(): void;
}

/** Hover height above the floor in tiles of height: the barrel tip (a hair under the foot) above the rock's top, so the beam drops onto the ore. */
const POD_Z = POD_HOVER_Z;

const LASER = 0xff6a3a;
/** A stowed pod (placeholder until the bay's parked sprite exists) sits this far below the deck, on the pit floor, and sorts behind the pit's near lip. */
const PIT_Z = -0.6;
const PIT_DEPTH = 0.6;
/** Mining loop: ms per frame. */
const MINE_FRAME_MS = 420;

export interface PodHost {
  /** The pod's size across in tiles, or undefined for a vehicle that is not a pod. */
  size(def: string): number | undefined;
  /** Air layer (flight) and the shared depth layer (in the bay); both sort by zIndex = sector depth. */
  air: Container;
  low: Container;
}

interface Track {
  root: Container;
  shadow: Graphics;
  /** The mining beam: in front of the pod, or behind it while the barrel is hidden by the hull. */
  fx: Graphics;
  fxBack: Graphics;
  body: Sprite;
  glow: Sprite;
  low: boolean;
}

export function createPodView(world: World, atlas: Atlas, host: PodHost): PodView {
  const tracks = new Map<number, Track>();
  let clock = 0;
  const drop = (id: number): void => {
    const t = tracks.get(id);
    if (t && !t.root.destroyed) t.root.destroy({ children: true });
    tracks.delete(id);
  };
  const show = (t: Track, s: StaticSprite): void => {
    t.body.texture = s.tex;
    t.body.position.set(-s.ax, -s.ay);
    t.glow.visible = !!s.glow;
    if (s.glow) {
      t.glow.texture = s.glow;
      t.glow.position.set(-s.ax, -s.ay);
    }
  };
  return {
    update(dt) {
      clock += dt;
      const seen = new Set<number>();
      for (const id of world.query(VehicleC, BodyC)) {
        const v = world.get(id, VehicleC);
        const b = world.get(id, BodyC);
        const size = v && host.size(v.def);
        if (!v || !b || size === undefined || v.state === 'docked') continue;
        const low = v.state === 'stowed';
        // A stowed pod is the bay layer's `parked` sprite once that art exists.
        if (low && atlas.ids(`${v.def}.parked`).length > 0) continue;
        const d = headingIndex(b.heading);
        const frame = Math.floor((clock * 1000) / MINE_FRAME_MS) % 2;
        const m = world.get(id, MiningPodC);
        const mining = !low && m?.phase === 'mining' && !!m.target;
        const sprite = low
          ? atlas.firstOf([`${v.def}.docked.d${d & 6}`, `${v.def}.fly.d${d}`])
          : mining
            ? atlas.firstOf([`${v.def}.mine.d${d}.f${frame}`, `${v.def}.fly.d${d}`])
            : atlas.stat(`${v.def}.fly.d${d}`);
        if (!sprite) continue;
        seen.add(id);
        let t = tracks.get(id);
        if (!t || t.low !== low) {
          drop(id);
          const root = new Container();
          const shadow = new Graphics();
          const fx = new Graphics();
          const fxBack = new Graphics();
          const body = new Sprite();
          const glow = new Sprite();
          glow.blendMode = 'add';
          root.addChild(shadow, fxBack, body, glow, fx);
          (low ? host.low : host.air).addChild(root);
          t = { root, shadow, fx, fxBack, body, glow, low };
          tracks.set(id, t);
        }
        show(t, sprite);
        const p = sectorArt(b.x, b.y);
        const lift = (low ? PIT_Z : POD_Z) * Z_PX;
        // The shadow stays on the ground under the hovering pod.
        t.shadow.clear();
        if (!low) t.shadow.ellipse(0, lift, size * 30, size * 15).fill({ color: 0x000000, alpha: 0.3 });
        t.fx.clear();
        t.fxBack.clear();
        if (mining && m?.target) {
          const pulse = 0.6 + 0.4 * Math.sin(clock * 18);
          // From the barrel's emitter face straight along its axis (the sim puts the pod on a heading ray so the axis meets the ore's top
          // face, sim/mining/geometry.ts); behind the pod while the hull hides the barrel.
          const [sx, sy] = barrel(d, frame).tip;
          const [ex, ey] = beamEnd(d, frame);
          const beam = HIDDEN.has(d) ? t.fxBack : t.fx;
          beam.moveTo(sx, sy).lineTo(ex, ey).stroke({ color: LASER, width: Math.max(1, TILE_H / 12), alpha: pulse });
          t.fx.circle(ex, ey, TILE_H * 0.15).fill({ color: 0xffd0a0, alpha: pulse });
        }
        t.root.position.set(Math.round(p.x), Math.round(p.y - lift));
        t.root.zIndex = b.x + b.y + (low ? PIT_DEPTH : 0);
      }
      for (const id of [...tracks.keys()]) if (!seen.has(id)) drop(id);
    },
    dispose() {
      for (const id of [...tracks.keys()]) drop(id);
    },
  };
}
