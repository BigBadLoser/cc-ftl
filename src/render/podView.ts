import { Container, Graphics } from 'pixi.js';
import { BodyC } from '../sim/body';
import type { World } from '../sim/ecs';
import { MiningPodC } from '../sim/mining/components';
import { VehicleC } from '../sim/vehicles/components';
import { Z_PX } from './heights';
import { iso, TILE_H, TILE_W } from './iso';
import { sectorArt } from './sectorPos';

/**
 * PLACEHOLDER mining pods (procedural, allowed while pod art is pending; final art comes from the sprite pipeline): a small
 * hull lozenge with a cockpit light and a shadow on the ground, and a pulsing laser line down to the ore tile while it mines.
 * Drawn only in flight (a stowed pod sits in its bay, whose stand-in plate covers it). Sizes derive from TILE_W / TILE_H and the
 * height scale Z_PX, so it follows the tile size.
 */
export interface PodView {
  update(dt: number): void;
  dispose(): void;
}

/** Hover height above the floor, in tiles of height. */
const POD_Z = 1.3;
const HULL = 0xd8b45a;
const LASER = 0xff6a3a;

export function createPodView(world: World, layer: Container, isPod: (def: string) => boolean): PodView {
  const views = new Map<number, Graphics>();
  let clock = 0;
  return {
    update(dt) {
      clock += dt;
      const seen = new Set<number>();
      for (const id of world.query(VehicleC, BodyC)) {
        const v = world.get(id, VehicleC);
        const b = world.get(id, BodyC);
        if (!v || !b || !isPod(v.def) || v.state !== 'flying') continue;
        seen.add(id);
        let g = views.get(id);
        if (!g) {
          g = new Graphics();
          layer.addChild(g);
          views.set(id, g);
        }
        const p = sectorArt(b.x, b.y);
        const lift = POD_Z * Z_PX;
        const rx = TILE_W * 0.22, ry = TILE_H * 0.22;
        g.clear();
        g.ellipse(0, lift, rx, ry * 0.8).fill({ color: 0x000000, alpha: 0.35 });
        const m = world.get(id, MiningPodC);
        if (m?.phase === 'mining' && m.target) {
          const t = iso(m.target.x, m.target.y);
          const pulse = 0.6 + 0.4 * Math.sin(clock * 18);
          g.moveTo(0, 0).lineTo(t.x - p.x, t.y - p.y + lift).stroke({ color: LASER, width: Math.max(1, TILE_H / 16), alpha: pulse });
          g.circle(t.x - p.x, t.y - p.y + lift, TILE_H * 0.12).fill({ color: 0xffd0a0, alpha: pulse });
        }
        g.ellipse(0, 0, rx, ry).fill(HULL).stroke({ color: 0x5a4a28, width: Math.max(1, TILE_H / 32) });
        g.circle(Math.cos(b.heading) * rx * 0.4, Math.sin(b.heading) * ry * 0.4, ry * 0.35).fill(0x9ae8ff);
        g.position.set(Math.round(p.x), Math.round(p.y - lift));
        g.zIndex = b.x + b.y;
      }
      for (const [id, g] of views) {
        if (!seen.has(id)) {
          g.destroy();
          views.delete(id);
        }
      }
    },
    dispose() {
      for (const g of views.values()) g.destroy();
      views.clear();
    },
  };
}
