import { Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import type { Atlas } from './assets/loader';
import { backdropBodySprite, bodySpot, HAS_PROMINENCES } from './backdropPlan';

/**
 * The space behind the ships (issue #217): parallax star layers, a faint nebula wash tinted by the galaxy nebula at the node, and the
 * node's own star or planet, large, dim and far off the left side, clear of the HUD.
 * Every layer is a tiling sprite of a small texture made once per node (seeded), shown at a whole number of device px per texel
 * with nearest sampling, and moved by a fraction of the camera pan. Nothing is redrawn per frame; `update` sets a few offsets.
 * PLACEHOLDER art: the final textures come from the Blender sprite pipeline.
 */

export interface BackdropSpec {
  /** Per-node seed. */
  seed: number;
  /** Galaxy nebula density at the node, 0..1. */
  density: number;
  /** The sector's central body kind (`star`, `gas_giant`, ...), or null. */
  body: string | null;
  /** Hash of the sector id: picks the body's variant as the starmap does. */
  bodyHash: number;
}

export interface Backdrop {
  readonly root: Container;
  setSpec(spec: BackdropSpec): void;
  /** Place for a camera: canvas size and the world's origin (device px), and device px per CSS px. */
  update(w: number, h: number, originX: number, originY: number, dpr: number): void;
  dispose(): void;
}

type Rgb = [number, number, number];
const NEBULA_HUES: readonly Rgb[] = [[42, 120, 132], [96, 66, 150], [150, 62, 112], [150, 98, 60], [52, 86, 164], [58, 130, 96]];
const STAR_TINTS: readonly Rgb[] = [[255, 255, 255], [255, 255, 255], [190, 215, 255], [255, 232, 200], [255, 205, 190]];

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toTexture(c: HTMLCanvasElement): Texture {
  const t = Texture.from(c);
  t.source.scaleMode = 'nearest';
  t.source.style.addressMode = 'repeat';
  t.source.autoGenerateMipmaps = false;
  return t;
}

function canvasOf(size: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return { c, ctx: c.getContext('2d')! };
}

/** A tile of single-texel stars (a few with a plus-shaped flare), tinted, each with its own alpha. */
function starTile(seed: number, size: number, count: number, alpha: [number, number], flares: number, tints: readonly Rgb[] = STAR_TINTS): Texture {
  const r = rng(seed);
  const { c, ctx } = canvasOf(size);
  const put = (x: number, y: number, col: Rgb, a: number): void => {
    ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`;
    ctx.fillRect(((x % size) + size) % size, ((y % size) + size) % size, 1, 1);
  };
  for (let i = 0; i < count; i++) {
    const col = tints[Math.floor(r() * tints.length)]!;
    const a = alpha[0] + r() * (alpha[1] - alpha[0]);
    const x = Math.floor(r() * size);
    const y = Math.floor(r() * size);
    put(x, y, col, a);
    if (i < flares) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(x + dx, y + dy, col, a * 0.35);
  }
  return toTexture(c);
}

/** Wrapping value noise on a g x g lattice, smoothstep-interpolated, sampled over a size x size tile. */
function noiseTile(r: () => number, size: number, g: number): Float32Array {
  const lat = new Float32Array(g * g);
  for (let i = 0; i < lat.length; i++) lat[i] = r();
  const out = new Float32Array(size * size);
  const s = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * g;
    const y0 = Math.floor(fy);
    const ty = s(fy - y0);
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * g;
      const x0 = Math.floor(fx);
      const tx = s(fx - x0);
      const a = lat[(y0 % g) * g + (x0 % g)]!;
      const b = lat[(y0 % g) * g + ((x0 + 1) % g)]!;
      const c = lat[((y0 + 1) % g) * g + (x0 % g)]!;
      const d = lat[((y0 + 1) % g) * g + ((x0 + 1) % g)]!;
      out[y * size + x] = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    }
  }
  return out;
}

/**
 * A tileable cloud: noise at three scales, cut into three stepped bands (the starmap nebula's hard-edged look), each band a
 * flat colour at its own alpha. `cover` (0..1) is how much of the tile is cloud.
 */
function cloudTile(seed: number, size: number, hue: Rgb, cover: number, alphas: [number, number, number], shade = 1): Texture {
  const r = rng(seed);
  const n1 = noiseTile(r, size, 3);
  const n2 = noiseTile(r, size, 6);
  const n3 = noiseTile(r, size, 12);
  const { c, ctx } = canvasOf(size);
  const img = ctx.createImageData(size, size);
  const base = 0.74 - 0.34 * cover;
  for (let i = 0; i < size * size; i++) {
    const v = n1[i]! * 0.55 + n2[i]! * 0.3 + n3[i]! * 0.15;
    const band: 0 | 1 | 2 | -1 = v > base + 0.2 ? 2 : v > base + 0.1 ? 1 : v > base ? 0 : -1;
    if (band === -1) continue;
    const k = shade * (0.8 + band * 0.2);
    img.data[i * 4] = Math.min(255, hue[0] * k);
    img.data[i * 4 + 1] = Math.min(255, hue[1] * k);
    img.data[i * 4 + 2] = Math.min(255, hue[2] * k);
    img.data[i * 4 + 3] = Math.round(255 * alphas[band]!);
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c);
}

interface Layer {
  sprite: TilingSprite;
  /** Share of the camera pan it follows. */
  factor: number;
  /** Device px per texel, in CSS px (times dpr). */
  px: number;
}

export function createBackdrop(atlas: Atlas): Backdrop {
  const root = new Container();
  root.eventMode = 'none';
  root.interactiveChildren = false;
  let layers: Layer[] = [];
  let textures: Texture[] = [];
  let body: { sprite: Sprite; glow: Sprite; mask: Graphics; fitH: number; kind: string; hash: number; fx: number; fy: number; factor: number } | null = null;
  let key = '';
  let ref: { x: number; y: number } | null = null;
  let size = { w: 1, h: 1, dpr: 1 };

  function clear(): void {
    for (const l of layers) l.sprite.destroy();
    for (const t of textures) t.destroy(true);
    body?.sprite.destroy();
    body?.glow.destroy();
    body?.mask.destroy();
    layers = [];
    textures = [];
    body = null;
    ref = null;
  }

  function add(tex: Texture, factor: number, px: number, alpha = 1): void {
    textures.push(tex);
    const sprite = new TilingSprite({ texture: tex, width: 1, height: 1, roundPixels: true });
    sprite.alpha = alpha;
    sprite.eventMode = 'none';
    root.addChild(sprite);
    layers.push({ sprite, factor, px });
  }

  function build(spec: BackdropSpec): void {
    const s = spec.seed;
    const hue = NEBULA_HUES[s % NEBULA_HUES.length]!;
    const d = Math.max(0, Math.min(1, spec.density));
    // Order is back to front.
    add(cloudTile(s + 11, 128, hue, 0.12 + d * 0.5, [0.035, 0.06, 0.09]), 0.03, 8);
    add(starTile(s + 31, 256, 70, [0.25, 0.5], 0), 0.04, 2);
    add(starTile(s + 41, 256, 34, [0.4, 0.75], 4), 0.1, 3);
    if (spec.body) {
      const sprite = new Sprite(Texture.EMPTY);
      sprite.anchor.set(0.5);
      // Opaque, dimmed by a dark tint instead of alpha (about what 0.4 alpha of 0x8a94a8 over the clear colour gave), so no star shows through the disc.
      sprite.tint = 0x383c44;
      sprite.visible = false;
      sprite.eventMode = 'none';
      // The glow twin of the dedicated art (halos), added over the body at low strength.
      const glow = new Sprite(Texture.EMPTY);
      glow.anchor.set(0.5);
      glow.alpha = 0.2;
      glow.blendMode = 'add';
      glow.visible = false;
      glow.eventMode = 'none';
      const mask = new Graphics();
      // Above the star and nebula layers (it hides what lies behind it), under every ship; its halo is soft and additive.
      root.addChild(sprite, glow);
      root.addChild(mask);
      body = { sprite, glow, mask, fitH: 0, kind: spec.body, hash: spec.bodyHash, ...bodySpot(s), factor: 0.012 };
    }
    layout();
  }

  function layout(): void {
    const { w, h, dpr } = size;
    for (const l of layers) {
      l.sprite.width = w;
      l.sprite.height = h;
      const px = Math.max(1, Math.round(l.px * dpr));
      l.sprite.tileScale.set(px);
    }
  }

  function placeBody(originX: number, originY: number): void {
    if (!body) return;
    ref ??= { x: originX, y: originY };
    const sp = body.sprite;
    // Looked up every frame: the sheet is an env sheet the atlas may evict, and a lookup keeps it in use (and says when it is gone).
    const ids = backdropBodySprite((id) => !!atlas.manifest.assets[id], body.kind, body.hash);
    const st = atlas.firstOf(ids);
    if (!st) {
      sp.visible = false;
      body.glow.visible = false;
      return;
    }
    if (sp.texture !== st.tex || body.fitH !== size.h) {
      body.fitH = size.h;
      sp.texture = st.tex;
      // The sphere's radius is 5/16 of the frame; fit it to about a sixth of the view height, in whole texel multiples.
      const radiusTex = st.tex.width * (5 / 16);
      const k = Math.max(1, Math.round((size.h * 0.17) / radiusTex));
      sp.scale.set(k);
      // A starmap star's prominence loops stand just off the limb: cut everything past the disc (only the stand-in has them; the dedicated art has none).
      body.mask.clear();
      if (HAS_PROMINENCES.has(body.kind) && !atlas.manifest.assets[ids[0]!]) {
        body.mask.circle(0, 0, st.tex.width * 0.31 * k).fill(0xffffff);
        sp.mask = body.mask;
      } else sp.mask = null;
      body.glow.texture = st.glow ?? Texture.EMPTY;
      body.glow.scale.set(k);
    }
    sp.visible = true;
    body.glow.visible = !sp.mask && !!st.glow;
    sp.position.set(Math.round(size.w * body.fx + (originX - ref.x) * body.factor), Math.round(size.h * body.fy + (originY - ref.y) * body.factor));
    body.mask.position.copyFrom(sp.position);
    body.glow.position.copyFrom(sp.position);
  }

  return {
    root,
    setSpec(spec) {
      const k = `${spec.seed}|${spec.density.toFixed(2)}|${spec.body}|${spec.bodyHash}`;
      if (k === key) return;
      key = k;
      clear();
      build(spec);
    },
    update(w, h, originX, originY, dpr) {
      if (w !== size.w || h !== size.h || dpr !== size.dpr) {
        size = { w, h, dpr };
        layout();
      }
      for (const l of layers) l.sprite.tilePosition.set(Math.round(originX * l.factor), Math.round(originY * l.factor));
      placeBody(originX, originY);
    },
    dispose() {
      clear();
      root.destroy();
    },
  };
}
