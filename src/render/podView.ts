import { Container, Graphics } from 'pixi.js';
import { BodyC } from '../sim/body';
import type { World } from '../sim/ecs';
import { MiningPodC } from '../sim/mining/components';
import { VehicleC } from '../sim/vehicles/components';
import { ROCK_MASS_Z } from './asteroidView';
import { Z_PX } from './heights';
import { iso, TILE_H, TILE_W } from './iso';
import { sectorArt } from './sectorPos';

/**
 * PLACEHOLDER mining pods (procedural, allowed while pod art is pending; final art comes from the sprite pipeline). A pod is
 * `size` tiles across (VehicleDef.size, about 2.6: it nearly fills its 3x3 bay): a hull ellipse inscribed in that footprint's
 * diamond, a canopy with the pilot as a seated stand-in (head and shoulders) when someone is aboard, and a ground shadow of
 * the same footprint. In its bay it sits on the deck in the shared depth layer; in flight it hovers above the tallest rock
 * (ROCK_MASS_Z plus a margin), so it never dips into rock mass, and while it mines a pulsing laser runs from its belly to
 * the tile centre. Every size derives from TILE_W / TILE_H and Z_PX, so it follows the tile size.
 */
export interface PodView {
  update(dt: number): void;
  dispose(): void;
}

/** Hover height above the floor in tiles of height: clear of rock mass, as the pod is wide. */
const POD_Z = ROCK_MASS_Z + 0.9;
const HULL = 0xd8b45a;
const LASER = 0xff6a3a;

export interface PodHost {
  /** The pod's size across in tiles, or undefined for a vehicle that is not a pod. */
  size(def: string): number | undefined;
  /** Air layer (flight) and the shared depth layer (in the bay); both sort by zIndex = sector depth. */
  air: Container;
  low: Container;
}

function drawPod(g: Graphics, size: number, heading: number, pilot: boolean, lift: number, shadow: boolean): void {
  const rx = size * TILE_W * 0.36;
  const ry = size * TILE_H * 0.36;
  if (shadow) g.ellipse(0, lift, rx, ry).fill({ color: 0x000000, alpha: 0.35 });
  const thick = ry * 0.5;
  // hull: a lower band for thickness, then the top
  g.ellipse(0, thick, rx, ry).fill(0x7a6430);
  g.rect(-rx, 0, rx * 2, thick).fill(0x7a6430);
  g.ellipse(0, 0, rx, ry).fill(HULL).stroke({ color: 0x5a4a28, width: Math.max(1, TILE_H / 32) });
  // canopy towards the heading
  const cx = Math.cos(heading) * rx * 0.35, cy = Math.sin(heading) * ry * 0.35;
  g.ellipse(cx, cy, rx * 0.38, ry * 0.42).fill(0x2a4a5a).stroke({ color: 0x9ae8ff, width: Math.max(1, TILE_H / 32) });
  if (pilot) {
    g.ellipse(cx, cy + ry * 0.08, rx * 0.16, ry * 0.18).fill(0x4a6a8a); // shoulders
    g.circle(cx, cy - ry * 0.14, ry * 0.14).fill(0xe0b090); // head
  }
}

export function createPodView(world: World, host: PodHost): PodView {
  const views = new Map<number, { g: Graphics; low: boolean }>();
  let clock = 0;
  return {
    update(dt) {
      clock += dt;
      const seen = new Set<number>();
      for (const id of world.query(VehicleC, BodyC)) {
        const v = world.get(id, VehicleC);
        const b = world.get(id, BodyC);
        const size = v && host.size(v.def);
        if (!v || !b || size === undefined || v.state === 'docked') continue;
        seen.add(id);
        const low = v.state === 'stowed';
        let view = views.get(id);
        if (!view || view.low !== low) {
          view?.g.destroy();
          view = { g: new Graphics(), low };
          (low ? host.low : host.air).addChild(view.g);
          views.set(id, view);
        }
        const g = view.g;
        const p = sectorArt(b.x, b.y);
        const lift = low ? 0 : POD_Z * Z_PX;
        g.clear();
        const m = world.get(id, MiningPodC);
        if (!low && m?.phase === 'mining' && m.target) {
          const t = iso(m.target.x, m.target.y);
          const pulse = 0.6 + 0.4 * Math.sin(clock * 18);
          g.moveTo(0, size * TILE_H * 0.2).lineTo(t.x - p.x, t.y - p.y + lift).stroke({ color: LASER, width: Math.max(1, TILE_H / 12), alpha: pulse });
          g.circle(t.x - p.x, t.y - p.y + lift, TILE_H * 0.15).fill({ color: 0xffd0a0, alpha: pulse });
        }
        drawPod(g, size, b.heading, v.pilot !== 0, lift, !low);
        g.position.set(Math.round(p.x), Math.round(p.y - lift));
        g.zIndex = b.x + b.y + (low ? size / 2 : 0);
      }
      for (const [id, view] of views) {
        if (!seen.has(id)) {
          view.g.destroy();
          views.delete(id);
        }
      }
    },
    dispose() {
      for (const view of views.values()) view.g.destroy();
      views.clear();
    },
  };
}
