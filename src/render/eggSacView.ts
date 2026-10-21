import type { Sprite } from 'pixi.js';
import { EggSacC, type EggSac } from '../sim/aliens/components';
import type { World } from '../sim/ecs';
import type { Grid } from '../sim/grid';
import type { Atlas } from './assets/loader';
import { ART_SCALE as S, depthKey, iso } from './iso';
import type { Layers } from './layers';
import { addStatic } from './sprites';

/**
 * Egg sacs on a derelict (sim EggSacC entities), drawn with their state art: `decay.eggsac.<n>x<n>` dormant,
 * `.cracked` (leaking), `.hatch0`..`.hatch2` while hatching, `.burst` when spent. Anchored on the footprint's front tile,
 * like the old static hook dressing. Rebuilt per sac when its look changes; tinted by the tile light (region-local tiles).
 */
export interface EggSacView {
  update(): void;
  /** A live sac under a region-local art point (for attack orders), and its art y. */
  pick(ax: number, ay: number): { id: number; y: number } | null;
  dispose(): void;
}

/** The art id of a sac's current look. */
export function sacArt(sac: EggSac): string {
  const base = `decay.eggsac.${sac.size}x${sac.size}`;
  if (sac.state === 'burst') return `${base}.burst`;
  if (sac.state === 'hatching') return `${base}.hatch${Math.min(2, sac.stage)}`;
  return sac.leaking ? `${base}.cracked` : base;
}

interface Slot {
  art: string;
  sprites: Sprite[];
  x: number;
  y: number;
}

export function createEggSacView(grid: Grid, world: World, atlas: Atlas, L: Layers, tintAt?: (x: number, y: number, wall: boolean) => number): EggSacView {
  const slots = new Map<number, Slot>();
  const drop = (s: Slot) => {
    for (const spr of s.sprites) spr.destroy();
  };
  return {
    update() {
      const seen = new Set<number>();
      for (const id of world.query(EggSacC)) {
        const sac = world.get(id, EggSacC);
        if (!sac || sac.ship !== grid.id) continue;
        seen.add(id);
        const art = sacArt(sac);
        let s = slots.get(id);
        if (s && s.art === art) {
          if (s.sprites[0] && tintAt) s.sprites[0].tint = tintAt(sac.x - grid.x0, sac.y - grid.y0, false);
          continue;
        }
        if (s) drop(s);
        const k = sac.size - 1;
        const x = sac.x - grid.x0 + k, y = sac.y - grid.y0 + k;
        const st = atlas.firstOf([art, `decay.eggsac.${sac.size}x${sac.size}`]);
        const sprites = st ? addStatic(L, st, x, y, depthKey(x, y) - 0.2) : [];
        if (sprites[0] && tintAt) sprites[0].tint = tintAt(sac.x - grid.x0, sac.y - grid.y0, false);
        s = { art, sprites, x, y };
        slots.set(id, s);
      }
      for (const [id, s] of slots) {
        if (seen.has(id)) continue;
        drop(s);
        slots.delete(id);
      }
    },
    pick(ax, ay) {
      let best: { id: number; y: number } | null = null;
      for (const [id, s] of slots) {
        const sac = world.get(id, EggSacC);
        if (!sac || sac.state === 'burst') continue;
        const p = iso(s.x, s.y);
        const hw = 18 * S * sac.size, h = 26 * S * sac.size;
        if (Math.abs(ax - p.x) <= hw && ay >= p.y - h && ay <= p.y + 8 * S && (!best || p.y > best.y)) best = { id, y: p.y };
      }
      return best;
    },
    dispose() {
      for (const s of slots.values()) drop(s);
      slots.clear();
    },
  };
}
