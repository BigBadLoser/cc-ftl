/**
 * The nebula backdrop: the three nebula glow tiles (`starmap.nebula.haze|body|core`), repeated across the field, each shown where the
 * blurred density passes its step (hard-edged masks, the stepped look), composed once into one canvas that the map shows as a single
 * screen-blended sprite. One mask pixel is one baked pixel and the textures scale with nearest sampling, so the pixel look is crisp.
 */
import type { UiNebulaTile, UiStarArt } from '../../ui/starmapApi';

/** Density steps of the nebula sprites (ARCHITECTURE.md, "Starmap art"): haze, body, core. */
export const STEPS = [
  { id: 'starmap.nebula.haze', at: 0.15, alpha: 0.18 },
  { id: 'starmap.nebula.body', at: 0.45, alpha: 0.22 },
  { id: 'starmap.nebula.core', at: 0.8, alpha: 0.3 },
] as const;
/** Mask samples per density sample: the step edges stay hard but follow the (interpolated) density, not its sample grid. */
const UP = 8;
/** The share of the square, at each edge, that fades out. */
const EDGE = 0.18;

export interface Baked {
  canvas: HTMLCanvasElement;
  /** Where the square sits in map units. */
  x0: number;
  y0: number;
  side: number;
}

/** The stitched, blurred density of the tiles, side `w` samples. */
function density(tiles: UiNebulaTile[], x0: number, y0: number, cols: number): { soft: Float32Array; w: number } {
  const n = tiles[0]!.n;
  const size = tiles[0]!.size;
  const w = cols * n;
  const raw = new Float32Array(w * w);
  for (const t of tiles) {
    const ox = Math.round((t.x - x0) / size) * n;
    const oy = Math.round((t.y - y0) / size) * n;
    for (let k = 0; k < t.data.length; k++) raw[(oy + Math.floor(k / n)) * w + ox + (k % n)] = t.data[k]! / 255;
  }
  return { soft: blur(raw, w, 7), w };
}

function blur(src: Float32Array, w: number, r: number): Float32Array {
  let a = src;
  for (let pass = 0; pass < 4; pass++) {
    const b = new Float32Array(a.length);
    const horiz = pass % 2 === 0;
    for (let row = 0; row < w; row++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += a[horiz ? row * w + Math.max(0, Math.min(w - 1, k)) : Math.max(0, Math.min(w - 1, k)) * w + row]!;
      for (let i = 0; i < w; i++) {
        b[horiz ? row * w + i : i * w + row] = sum / (2 * r + 1);
        const add = Math.min(w - 1, i + r + 1);
        const sub = Math.max(0, i - r);
        sum += a[horiz ? row * w + add : add * w + row]! - a[horiz ? row * w + sub : sub * w + row]!;
      }
    }
    a = b;
  }
  return a;
}

const canvasOf = (w: number) => Object.assign(document.createElement('canvas'), { width: w, height: w });

/** The last bake: the same tiles come back on every snapshot until the player moves a tile or more. */
let last: { key: string; baked: Baked } | null = null;

/** Each step is its texture, tiled every half tile and cut by that step's density threshold, drawn at its alpha over the ones below. */
export function bakeNebula(tiles: UiNebulaTile[], art: UiStarArt, glow: HTMLImageElement): Baked | null {
  if (!tiles.length || !STEPS.every((st) => art.frames[st.id])) return null;
  const key = tiles.map((t) => t.id).join('|');
  if (last?.key === key) return last.baked;
  const x0 = Math.min(...tiles.map((t) => t.x));
  const y0 = Math.min(...tiles.map((t) => t.y));
  const cols = Math.round(Math.sqrt(tiles.length));
  const size = tiles[0]!.size;
  const { soft, w } = density(tiles, x0, y0, cols);
  const W = w * UP;
  // The step textures, each cut out of the glow sheet.
  const imgs = STEPS.map((st) => {
    const f = art.frames[st.id]!;
    const c = document.createElement('canvas');
    c.width = f.w;
    c.height = f.h;
    c.getContext('2d')!.drawImage(glow, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    return c;
  });
  const at = (x: number, y: number) => soft[Math.max(0, Math.min(w - 1, y)) * w + Math.max(0, Math.min(w - 1, x))]!;
  const fine = new Float32Array(W * W);
  for (let j = 0; j < W; j++) {
    const fy = (j + 0.5) / UP - 0.5;
    const y = Math.floor(fy);
    const ty = fy - y;
    for (let i = 0; i < W; i++) {
      const fx = (i + 0.5) / UP - 0.5;
      const x = Math.floor(fx);
      const tx = fx - x;
      const top = at(x, y) + (at(x + 1, y) - at(x, y)) * tx;
      const bot = at(x, y + 1) + (at(x + 1, y + 1) - at(x, y + 1)) * tx;
      fine[j * W + i] = Math.min(1, (top + (bot - top) * ty) * 1.2);
    }
  }
  const out = canvasOf(W);
  const octx = out.getContext('2d')!;
  const layer = canvasOf(W);
  const lctx = layer.getContext('2d')!;
  const mask = canvasOf(W);
  const mctx = mask.getContext('2d')!;
  const img = mctx.createImageData(W, W);
  const cell = ((size / 2) * W) / (size * cols);
  // The patterns tile from the map origin: shift by the box's offset into a pattern cell.
  const shift = (v: number) => ((((-v * W) / (size * cols)) % cell) + cell) % cell - cell;
  lctx.imageSmoothingEnabled = false;
  octx.imageSmoothingEnabled = false;
  STEPS.forEach((step, i) => {
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, W, W);
    for (let y = shift(y0); y < W; y += cell) for (let x = shift(x0); x < W; x += cell) lctx.drawImage(imgs[i]!, Math.round(x), Math.round(y), Math.ceil(cell), Math.ceil(cell));
    for (let k = 0; k < fine.length; k++) img.data[k * 4 + 3] = fine[k]! > step.at ? 255 : 0;
    mctx.putImageData(img, 0, 0);
    lctx.globalCompositeOperation = 'destination-in';
    lctx.drawImage(mask, 0, 0);
    octx.globalAlpha = step.alpha;
    octx.drawImage(layer, 0, 0);
  });
  // Fade the square's edges into the backdrop, so zooming out never shows where the generated field ends.
  octx.globalAlpha = 1;
  octx.globalCompositeOperation = 'destination-in';
  const edge = EDGE;
  for (const vertical of [false, true]) {
    const grad = vertical ? octx.createLinearGradient(0, 0, 0, W) : octx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(edge, 'rgba(0,0,0,1)');
    grad.addColorStop(1 - edge, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    octx.fillStyle = grad;
    octx.fillRect(0, 0, W, W);
  }
  octx.globalCompositeOperation = 'source-over';
  const baked = { canvas: out, x0, y0, side: cols * size };
  last = { key, baked };
  return baked;
}
