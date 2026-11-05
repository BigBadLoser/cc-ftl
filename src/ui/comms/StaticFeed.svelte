<script lang="ts">
  import { reducedMotion } from './beat';

  /**
   * A dead screen: slow, dim noise with scanlines and a centred label. Takes `tone` ('grey' or 'cyan' for the sensor screen), `label`, an optional
   * corner `tag`, and `still` (draw one frame only, for stills). Fills its parent.
   */
  let { tone = 'grey', label, tag, still = false }: { tone?: 'grey' | 'cyan'; label?: string; tag?: string; still?: boolean } = $props();
  let canvas = $state<HTMLCanvasElement>();
  const N = 56;
  $effect(() => {
    const g = canvas?.getContext('2d');
    if (!g) return;
    const img = g.createImageData(N, N);
    const draw = (): void => {
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random();
        const lit = v > 0.82 ? 1 : v * 0.5;
        d[i] = tone === 'cyan' ? 20 + lit * 40 : 40 + lit * 90;
        d[i + 1] = tone === 'cyan' ? 50 + lit * 120 : 46 + lit * 98;
        d[i + 2] = tone === 'cyan' ? 70 + lit * 150 : 52 + lit * 104;
        d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    };
    draw();
    if (still || reducedMotion()) return;
    const t = setInterval(draw, 160);
    return () => clearInterval(t);
  });
</script>

<div class="feed" class:cyan={tone === 'cyan'}>
  <canvas bind:this={canvas} width={N} height={N}></canvas>
  <i class="lines"></i>
  {#if tag}<span class="tag">{tag}</span>{/if}
  {#if label}<span class="label">{label}</span>{/if}
</div>

<style>
  .feed { position: relative; width: 100%; height: 100%; overflow: hidden; background: #06090c; border: 1px solid var(--line-hi); box-sizing: border-box; }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; opacity: 0.4; }
  .cyan canvas { opacity: 0.32; }
  .lines { position: absolute; inset: 0; background: repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.35) 0 1px, transparent 1px 3px); }
  .label { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); text-align: center; font: 10px var(--pixel-font); letter-spacing: 0.08em; color: var(--dim); background: rgba(6, 9, 12, 0.75); padding: 3px 0; }
  .tag { position: absolute; left: 6px; top: 4px; font: 9px var(--pixel-font); letter-spacing: 0.06em; color: var(--dim); z-index: 1; }
  .cyan .tag { color: var(--cyan); }
</style>
