<script lang="ts" module>
  import type { UiNebulaTile } from './starmapApi';

  const smooth = (a: number, b: number, v: number) => {
    const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  /** The last painting: the same tiles come back on every snapshot until the player moves a tile or more. */
  let last: { key: string; url: string } | null = null;

  /**
   * The tiles (a full square of equal tiles) stitched into one image, so they blend without seams. Density to colour:
   * a thin violet haze at the edges of the nebula, deeper blue in its body, a paler core where it is densest.
   */
  function paint(tiles: UiNebulaTile[], x0: number, y0: number, cols: number): string {
    const key = tiles.map((t) => t.id).join('|');
    if (last?.key === key) return last.url;
    const n = tiles[0]!.n;
    const size = tiles[0]!.size;
    const c = document.createElement('canvas');
    c.width = c.height = cols * n;
    const ctx = c.getContext('2d');
    if (!ctx) return '';
    const img = ctx.createImageData(cols * n, cols * n);
    for (const t of tiles) {
      const ox = Math.round((t.x - x0) / size) * n;
      const oy = Math.round((t.y - y0) / size) * n;
      for (let k = 0; k < t.data.length; k++) {
        const d = t.data[k]! / 255;
        const m = smooth(0.2, 0.75, d);
        const core = smooth(0.8, 1, d);
        const p = ((oy + Math.floor(k / n)) * cols * n + ox + (k % n)) * 4;
        img.data[p] = 96 - 50 * m + 60 * core;
        img.data[p + 1] = 70 + 50 * m + 60 * core;
        img.data[p + 2] = 180 + 15 * m + 30 * core;
        img.data[p + 3] = 255 * (0.16 * smooth(0.05, 0.6, d) + 0.05 * core);
      }
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
