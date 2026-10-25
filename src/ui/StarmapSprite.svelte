<script lang="ts" module>
  /**
   * The crisp size of an icon (ARCHITECTURE.md, "Starmap art"): a whole number k >= 1 of device px per art px, the nearest to
   * `target` screen px, never smaller than the art. Returns the drawn size in screen px.
   */
  export function crispPx(frame: number, target: number, dpr: number): number {
    const k = Math.max(1, Math.round((target * dpr) / frame));
    return (frame * k) / dpr;
  }
</script>

<script lang="ts">
  import type { UiStarArt } from './starmapApi';
  import { untrack } from 'svelte';
  import { tintedFrame } from './starmapTint';

  /**
   * One `starmap.*` sprite centred on (x, y), `size` map units square (the frame's side), its glow twin added over it. With
   * `tint`, the livery's key colours are swapped for the owner's (starmapTint.ts) before it is drawn.
   */
  let { art, id, x, y, size, tint = null, opacity = 1 }: {
    art: UiStarArt; id: string; x: number; y: number; size: number;
    tint?: { cloth: [number, number, number]; accent: [number, number, number] } | null; opacity?: number;
  } = $props();

  const f = $derived(art.frames[id]);
  let tinted = $state<string | null>(null);
  /** The tint by value: callers may pass a fresh object each render, and only a new colour should cut a new frame. */
  const tintKey = $derived(tint ? `${id}|${tint.cloth.join(',')}|${tint.accent.join(',')}` : '');
  $effect(() => {
    if (!tintKey) return;
    const t = untrack(() => tint)!;
    let live = true;
    void tintedFrame(art, id, t.cloth, t.accent).then((u) => live && (tinted = u));
    return () => (live = false);
  });
</script>

{#if f}
  <g class="spr" {opacity}>
    {#if tint}
      {#if tinted}
        <svg x={x - size / 2} y={y - size / 2} width={size} height={size} viewBox="0 0 {f.w} {f.h}" preserveAspectRatio="none">
          <image href={tinted} width={f.w} height={f.h} />
        </svg>
      {/if}
    {:else}
      <svg x={x - size / 2} y={y - size / 2} width={size} height={size} viewBox="{f.x} {f.y} {f.w} {f.h}" preserveAspectRatio="none">
        <image href={art.src} width={art.w} height={art.h} />
      </svg>
    {/if}
    {#if f.glow && art.glow}
      <svg class="glow" x={x - size / 2} y={y - size / 2} width={size} height={size} viewBox="{f.x} {f.y} {f.w} {f.h}" preserveAspectRatio="none">
        <image href={art.glow} width={art.w} height={art.h} />
      </svg>
    {/if}
  </g>
{/if}

<style>
  .spr { pointer-events: none; }
  image { image-rendering: pixelated; }
  .glow { mix-blend-mode: screen; }
</style>
