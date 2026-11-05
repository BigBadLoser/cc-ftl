<script lang="ts">
  import { reducedMotion, startBeat } from './beat';
  import StaticFeed from './StaticFeed.svelte';

  /**
   * The video screen: static with a label when there is no `src`, else the picture with scanlines and a LIVE badge. `stutter` makes the picture
   * hold and jitter now and then (a bad link); `force` holds that state for stills. Square, fills its parent's width.
   */
  let { src = null, label = 'NO VIDEO', live = true, stutter = false, force = false }: { src?: string | null; label?: string; live?: boolean; stutter?: boolean; force?: boolean } = $props();
  let hit = $state(false);
  // Reduced motion keeps the tell but calms it: the frame holds with the band and a dimmed LIVE badge, no jitter.
  const calm = reducedMotion();
  $effect(() => {
    if (!stutter || !src || force) return;
    return calm ? startBeat((v) => (hit = v), 3600, [900]) : startBeat((v) => (hit = v), 5200, [260, 600, 140]);
  });
  const glitch = $derived(!!src && stutter && (hit || force));
</script>

<div class="screen" class:calm>
  {#if src}
    <img {src} alt="" class:glitch />
    <i class="lines"></i>
    {#if glitch}<i class="tear"></i>{/if}
    {#if live}<span class="live" class:dim={glitch}>● LIVE</span>{/if}
  {:else}
    <StaticFeed {label} />
  {/if}
</div>

<style>
  .screen { position: relative; width: 100%; aspect-ratio: 1; border: 1px solid var(--line-hi); background: #05070a; overflow: hidden; }
  img { width: 100%; height: 100%; display: block; image-rendering: pixelated; object-fit: contain; }
  img.glitch { transform: translate(-4px, 1px); filter: brightness(1.3) saturate(0.6) contrast(1.15); }
  /* The frame holds and a bright band tears across it. */
  .calm img.glitch { transform: none; }
  .tear { position: absolute; left: 0; right: 0; top: 38%; height: 9%; background: rgba(170, 225, 255, 0.22); transform: translateX(6px); pointer-events: none; }
  .lines { position: absolute; inset: 0; background: repeating-linear-gradient(0deg, transparent 0 3px, rgba(0, 0, 0, 0.24) 3px 4px); pointer-events: none; }
  .live { position: absolute; left: 6px; top: 4px; font: 9px var(--pixel-font); color: var(--red); }
  .live.dim { opacity: 0.35; }
  .screen :global(.feed) { border: 0; }
</style>
