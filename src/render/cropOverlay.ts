import { Texture } from 'pixi.js';
import type { StaticSprite } from './assets/loader';
import { ART_SCALE as K, TILE_H, TILE_W } from './iso';
import { Z_PX } from './heights';

/**
 * PLACEHOLDER crop layer for hydroponics beds until `module.hydroponics[_large].crop.<crop>.<stage>.r<n>` lands (docs/art-prompts/hydroponics.md):
 * small plant marks on a footprint's troughs, by crop (colour and shape) and stage (sprout, grow, ripe). Anchored like a module sprite, at the
 * footprint's front tile, so it replaces the real layer one for one.
 */
export type CropStage = 'sprout' | 'grow' | 'ripe';

const HW = TILE_W / 2;
const HH = TILE_H / 2;
/** Height of the trough's rim over the floor, in tiles: the plants stand on it. */
const RIM_Z = 0.42;
const cache = new Map<string, StaticSprite>();

interface Look { leaf: string; ripe: string; tall: number; wide: number }
const LOOK: Record<string, Look> = {
  greens: { leaf: '#58c24a', ripe: '#8be070', tall: 1, wide: 1.6 },
  beans: { leaf: '#2f7a3a', ripe: '#c4d070', tall: 2.4, wide: 0.9 },
  herbs: { leaf: '#6f9c8c', ripe: '#e8def8', tall: 1.2, wide: 1.1 },
  grain: { leaf: '#9db04a', ripe: '#e2b43c', tall: 2.2, wide: 0.7 },
};
const GROWN: Record<CropStage, number> = { sprout: 0.35, grow: 0.7, ripe: 1 };

/** The crop layer for a footprint `w` x `h` (rotation applied): `crop` is `greens | beans | herbs | grain`. */
export function cropOverlay(w: number, h: number, crop: string, stage: CropStage): StaticSprite {
  const key = `${w}x${h}|${crop}|${stage}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const look = LOOK[crop] ?? LOOK.greens!;
  const Z = Math.round(RIM_Z * Z_PX);
  const reach = Math.round(10 * K * look.tall * GROWN[stage]) + 4 * K;
  const minX = -h * HW, minY = -HH - Z - reach;
  const cw = (w + h) * HW + 2 * K, ch = (w + h) * HH + Z + reach + 2 * K;
  const cv = document.createElement('canvas');
  cv.width = cw;
  cv.height = ch;
  const g = cv.getContext('2d') as CanvasRenderingContext2D;
  const grown = GROWN[stage];
  const plant = (cx: number, cy: number): void => {
    const x = Math.round(cx - minX + K), y = Math.round(cy - minY + K - Z);
    const tall = Math.max(2 * K, Math.round(10 * K * look.tall * grown));
    const wide = Math.max(2 * K, Math.round(5 * K * look.wide * grown));
    g.fillStyle = look.leaf;
    g.fillRect(x - Math.floor(wide / 2), y - tall, wide, tall);
    if (stage === 'ripe') {
      g.fillStyle = look.ripe;
      g.fillRect(x - Math.floor(wide / 2) - K, y - tall - 2 * K, wide + 2 * K, 3 * K);
    }
  };
  // Three plants per footprint tile along the trough's long axis, drawn back to front.
  const cells: { i: number; j: number }[] = [];
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) cells.push({ i, j });
  cells.sort((a, b) => a.i + a.j - (b.i + b.j));
  for (const { i, j } of cells) {
    for (const t of [-0.25, 0, 0.25]) {
      const ti = i + t, tj = j - t;
      plant((ti - tj) * HW, (ti + tj) * HH);
    }
  }
  const tex = Texture.from(cv);
  tex.source.scaleMode = 'nearest';
  const s: StaticSprite = { tex, glow: null, ax: (w - h) * HW - minX + K, ay: (w + h - 2) * HH - minY + K, footprint: [w, h] };
  cache.set(key, s);
  return s;
}

/** The stage a crop shows: ripe once ready, sprout in the first part of its growing, grown after. */
export const cropStage = (growth: number, ready: boolean): CropStage => (ready ? 'ripe' : growth < 0.4 ? 'sprout' : 'grow');
