<script lang="ts" module>
  import type { UiNebulaTile } from './starmapApi';
  import { tokenRgb } from './starmapStyle';

  const smooth = (a: number, b: number, v: number) => {
    const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  /** The last painting: the same tiles come back on every snapshot until the player moves a tile or more. */
  let last: { key: string; url: string } | null = null;

  /** Density steps of the nebula sprites (ARCHITECTURE.md, "Starmap art"): haze, body, core. */
  export const STEPS = [
    { id: 'starmap.nebula.haze', at: 0.15, alpha: 0.18 },
    { id: 'starmap.nebula.body', at: 0.45, alpha: 0.22 },
    { id: 'starmap.nebula.core', at: 0.8, alpha: 0.3 },
  ] as const;
  /** Mask samples per density sample: the step edges stay hard but follow the (interpolated) density, not its sample grid. */
  const UP = 8;

  /** The stitched, blurred density of the tiles (as `paint` builds it), side `w` samples. */
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

  /** One hard-edged mask per density step (white where the density passes it), as image URLs, for the sprite tiles. */
  /** The baked nebula: the three masked texture layers composed once into one image (a blob URL), keyed by tiles and textures. */
  let lastBake: { key: string; url: string } | null = null;
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a decode cache, nothing renders from it
  const decoded = new Map<string, Promise<HTMLImageElement>>();
  const decode = (url: string) => {
    let hit = decoded.get(url);
    if (!hit) {
      const img = new Image();
      img.src = url;
      hit = img.decode().then(() => img);
      decoded.set(url, hit);
    }
    return hit;
  };
  const canvasOf = (w: number) => Object.assign(document.createElement('canvas'), { width: w, height: w });

  /**
   * Each step is its texture, tiled every half tile and cut by that step's density threshold, drawn at its alpha over the
   * ones below: what the three masked pattern rects drew, but done once instead of on every repaint of the map. One mask pixel
   * is one baked pixel and textures scale with nearest sampling, so the pixel look is the same.
   */
  async function bake(tiles: UiNebulaTile[], x0: number, y0: number, cols: number, tex: string[]): Promise<string> {
    const key = tiles.map((t) => t.id).join('|');
    if (lastBake?.key === key) return lastBake.url;
    const { soft, w } = density(tiles, x0, y0, cols);
    const size = tiles[0]!.size;
    const W = w * UP;
    const imgs = await Promise.all(tex.map(decode));
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
    const blob = await new Promise<Blob | null>((res) => out.toBlob(res));
    const url = blob ? URL.createObjectURL(blob) : '';
    lastBake = { key, url };
    return url;
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

  /**
   * The tiles (a full square of equal tiles) stitched into one image, so they blend without seams. The density is
   * blurred well past the width of its strands, so it reads as broad soft clouds. Density to colour: thin
   * haze at the edges of the nebula, a brighter body, a cyan core where it is densest (all from the theme tokens).
   */
  function paint(tiles: UiNebulaTile[], x0: number, y0: number, cols: number): string {
    const key = tiles.map((t) => t.id).join('|');
    if (last?.key === key) return last.url;
    const { soft, w } = density(tiles, x0, y0, cols);
    const c = document.createElement('canvas');
    c.width = c.height = w;
    const ctx = c.getContext('2d');
    if (!ctx) return '';
    const img = ctx.createImageData(w, w);
    // Theme colours: thin haze at the edge, the brighter rule colour in the body, cyan where it is densest.
    const haze = tokenRgb('--line');
    const hi = tokenRgb('--line-hi');
    const core_ = tokenRgb('--cyan');
    for (let k = 0; k < soft.length; k++) {
      const d = Math.min(1, soft[k]! * 1.2);
      const m = smooth(0.15, 0.7, d);
      const core = smooth(0.8, 1, d);
      const p = k * 4;
      for (let ch = 0; ch < 3; ch++) {
        const body = haze[ch]! + (hi[ch]! - haze[ch]!) * m;
        img.data[p + ch] = body + (core_[ch]! - body) * core;
      }
      img.data[p + 3] = 255 * (0.19 * smooth(0.1, 0.45, d) + 0.05 * core);
    }
    ctx.putImageData(img, 0, 0);
    last = { key, url: c.toDataURL() };
    return last.url;
  }
</script>

<script lang="ts">
  import type { UiStarArt } from './starmapApi';
  import { frameUrl } from './starmapTint';

  /**
   * The nebula backdrop, drawn inside the map transform under everything else. With the starmap art: the three nebula glow
   * tiles, repeated across the field, each shown where the density passes its step (hard-edged masks, the stepped look) and
   * added over the map. Without it: the painted field.
   */
  let { tiles, opacity = 1, art = null }: { tiles: UiNebulaTile[]; opacity?: number; art?: UiStarArt | null } = $props();

  const box = $derived.by(() => {
    if (!tiles.length) return null;
    const x0 = Math.min(...tiles.map((t) => t.x));
    const y0 = Math.min(...tiles.map((t) => t.y));
    const cols = Math.round(Math.sqrt(tiles.length));
    return { x0, y0, cols, side: cols * tiles[0]!.size, size: tiles[0]!.size };
  });
  let tex = $state<(string | null)[] | null>(null);
  $effect(() => {
    const a = art;
    if (!a || !STEPS.every((st) => a.frames[st.id])) return;
    let live = true;
    void Promise.all(STEPS.map((st) => frameUrl(a, st.id, true))).then((u) => live && (tex = u));
    return () => (live = false);
  });
  /** The baked image with the box it was made for (kept until the next one is ready, so moving across the galaxy never blanks the map). */
  let baked = $state<{ box: NonNullable<typeof box>; url: string } | null>(null);
  $effect(() => {
    const b = box;
    const t = tex;
    if (!b || !t || t.some((u) => !u)) return;
    let live = true;
    void bake(tiles, b.x0, b.y0, b.cols, t as string[]).then((u) => {
      if (!live || !u) return;
      const old = baked?.url;
      baked = { box: b, url: u };
      // The previous image has been replaced; free it once the new one is in place (the module cache keeps only the latest).
      if (old && old !== u) setTimeout(() => URL.revokeObjectURL(old), 1000);
    });
    return () => (live = false);
  });
  const url = $derived(box && !tex ? paint(tiles, box.x0, box.y0, box.cols) : '');
</script>

{#if baked}
  <image href={baked.url} x={baked.box.x0} y={baked.box.y0} width={baked.box.side} height={baked.box.side} preserveAspectRatio="none" {opacity} class="neb" />
{:else if box && url}
  <image href={url} x={box.x0} y={box.y0} width={box.side} height={box.side} preserveAspectRatio="none" {opacity} />
{/if}

<style>
  image { pointer-events: none; }
  .neb { mix-blend-mode: screen; image-rendering: pixelated; }
</style>
