<script lang="ts" module>
  import type { UiNebulaTile } from './starmapApi';
  import { tokenRgb } from './starmapStyle';

  const smooth = (a: number, b: number, v: number) => {
    const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  /** The last painting: the same tiles come back on every snapshot until the player moves a tile or more. */
  let last: { key: string; url: string } | null = null;
  let lastMasks: { key: string; urls: string[] } | null = null;

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
  function masks(tiles: UiNebulaTile[], x0: number, y0: number, cols: number): string[] {
    const key = tiles.map((t) => t.id).join('|');
    if (lastMasks?.key === key) return lastMasks.urls;
    const { soft, w } = density(tiles, x0, y0, cols);
    const at = (x: number, y: number) => soft[Math.max(0, Math.min(w - 1, y)) * w + Math.max(0, Math.min(w - 1, x))]!;
    // The density at mask sample (i, j), bilinear between the density samples.
    const W = w * UP;
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
    const urls = STEPS.map((step) => {
      const c = document.createElement('canvas');
      c.width = c.height = W;
      const ctx = c.getContext('2d');
      if (!ctx) return '';
      const img = ctx.createImageData(W, W);
      for (let k = 0; k < fine.length; k++) {
        const on = fine[k]! > step.at ? 255 : 0;
        img.data[k * 4] = img.data[k * 4 + 1] = img.data[k * 4 + 2] = on;
        img.data[k * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return c.toDataURL();
    });
    lastMasks = { key, urls };
    return urls;
  }

  /** A separable box blur of `src` (side `w`), run twice: close to a Gaussian of about `r` samples. */
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
  const stepMasks = $derived(box && tex ? masks(tiles, box.x0, box.y0, box.cols) : null);
  const url = $derived(box && !tex ? paint(tiles, box.x0, box.y0, box.cols) : '');
</script>

{#if box && tex && stepMasks}
  {@const t = box.size / 2}
  <defs>
    {#each STEPS as st, i (st.id)}
      <pattern id="sm-neb-{i}" patternUnits="userSpaceOnUse" width={t} height={t}><image href={tex[i]} width={t} height={t} /></pattern>
      <mask id="sm-neb-m{i}" maskUnits="userSpaceOnUse" x={box.x0} y={box.y0} width={box.side} height={box.side}>
        <image href={stepMasks[i]} x={box.x0} y={box.y0} width={box.side} height={box.side} preserveAspectRatio="none" class="mask" />
      </mask>
    {/each}
  </defs>
  <g class="neb" {opacity}>
    {#each STEPS as st, i (st.id)}
      <rect x={box.x0} y={box.y0} width={box.side} height={box.side} fill="url(#sm-neb-{i})" mask="url(#sm-neb-m{i})" opacity={st.alpha} />
    {/each}
  </g>
{:else if box && url}
  <image href={url} x={box.x0} y={box.y0} width={box.side} height={box.side} preserveAspectRatio="none" {opacity} />
{/if}

<style>
  image, rect { pointer-events: none; }
  .neb { mix-blend-mode: screen; }
  .mask { image-rendering: pixelated; }
  pattern image { image-rendering: pixelated; }
</style>
