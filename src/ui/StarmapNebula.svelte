<script lang="ts" module>
  import type { UiNebulaTile } from './starmapApi';

  const smooth = (a: number, b: number, v: number) => {
    const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  /** The last painting: the same tiles come back on every snapshot until the player moves a tile or more. */
  let last: { key: string; url: string } | null = null;

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
   * blurred well past the width of its strands, so it reads as broad soft clouds. Density to colour: violet
   * haze at the edges of the nebula, deeper blue in its body, a paler core where it is densest.
   */
  function paint(tiles: UiNebulaTile[], x0: number, y0: number, cols: number): string {
    const key = tiles.map((t) => t.id).join('|');
    if (last?.key === key) return last.url;
    const n = tiles[0]!.n;
    const size = tiles[0]!.size;
    const w = cols * n;
    const raw = new Float32Array(w * w);
    for (const t of tiles) {
      const ox = Math.round((t.x - x0) / size) * n;
      const oy = Math.round((t.y - y0) / size) * n;
      for (let k = 0; k < t.data.length; k++) raw[(oy + Math.floor(k / n)) * w + ox + (k % n)] = t.data[k]! / 255;
    }
    const soft = blur(raw, w, 7);
    const c = document.createElement('canvas');
    c.width = c.height = w;
    const ctx = c.getContext('2d');
    if (!ctx) return '';
    const img = ctx.createImageData(w, w);
    for (let k = 0; k < raw.length; k++) {
      const d = Math.min(1, soft[k]! * 1.2);
      const m = smooth(0.15, 0.7, d);
      const core = smooth(0.8, 1, d);
      const p = k * 4;
      img.data[p] = 96 - 50 * m + 60 * core;
      img.data[p + 1] = 70 + 50 * m + 60 * core;
      img.data[p + 2] = 180 + 15 * m + 30 * core;
      img.data[p + 3] = 255 * (0.19 * smooth(0.1, 0.45, d) + 0.05 * core);
    }
    ctx.putImageData(img, 0, 0);
    last = { key, url: c.toDataURL() };
    return last.url;
  }
</script>

<script lang="ts">
  /** The nebula backdrop, drawn inside the map transform under everything else. */
  let { tiles, opacity = 1 }: { tiles: UiNebulaTile[]; opacity?: number } = $props();

  const box = $derived.by(() => {
    if (!tiles.length) return null;
    const x0 = Math.min(...tiles.map((t) => t.x));
    const y0 = Math.min(...tiles.map((t) => t.y));
    const cols = Math.round(Math.sqrt(tiles.length));
    return { x0, y0, side: cols * tiles[0]!.size, url: paint(tiles, x0, y0, cols) };
  });
</script>

{#if box}
  <image href={box.url} x={box.x0} y={box.y0} width={box.side} height={box.side} preserveAspectRatio="none" {opacity} />
{/if}

<style>
  image { pointer-events: none; }
</style>
