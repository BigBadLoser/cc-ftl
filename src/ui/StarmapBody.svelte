<script lang="ts">
  /**
   * A sector's central body (star, gas giant, nebula, black hole...) at (x, y) with radius r, in the caller's units. With the
   * starmap art loaded it is the body sprite (`starmap.body.<kind>.v<n>`, the variant picked by `seed`, the sector id), drawn at
   * r / 60 world px (its 192 px frame is 3.2 r across). `mini`: the Cluster view's small bodies, the map units of one screen px:
   * the mini sprite instead, at the crisp icon size (whole device px per art px). Without art: the code shapes.
   */
  import { BODY_LOOK } from './starmapStyle';
  import type { UiStarArt } from './starmapApi';
  import StarmapSprite, { crispPx } from './StarmapSprite.svelte';
  import { bodyVariant } from './starmapArtIds';

  let { kind, x, y, r, dim = 1, art = null, seed = '', mini = 0 }: {
    kind: string; x: number; y: number; r: number; dim?: number; art?: UiStarArt | null; seed?: string; mini?: number;
  } = $props();

  const look = $derived(BODY_LOOK[kind] ?? BODY_LOOK.star!);
  const id = $derived(art ? bodyVariant(art, mini ? 'mini' : 'body', kind, seed) : null);
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const size = $derived.by(() => {
    if (!art || !id) return 0;
    if (!mini) return r * 3.2;
    const f = art.frames[id]!;
    return crispPx(f.w, (r / mini) * 3.2, dpr) * mini;
  });
</script>

{#if art && id}
  <StarmapSprite {art} {id} {x} {y} {size} opacity={dim} />
{:else}
  <g opacity={dim} class="body">
    <circle cx={x} cy={y} r={r * look.halo} fill={`url(#sm-glow-${kind})`} />
    {#if kind === 'gas_giant'}
      <circle cx={x} cy={y} r={r} class="core" style={`fill: ${look.core}`} />
      <ellipse cx={x} cy={y - r * 0.25} rx={r * 0.95} ry={r * 0.18} class="band" />
      <ellipse cx={x} cy={y} rx={r * 1.7} ry={r * 0.35} class="ring" stroke-width={r * 0.08} />
    {:else if kind === 'black_hole'}
      <circle cx={x} cy={y} r={r * 1.5} class="disc" stroke-width={r * 0.35} />
      <circle cx={x} cy={y} r={r} class="core" style={`fill: ${look.core}`} />
    {:else if kind !== 'nebula'}
      <circle cx={x} cy={y} r={r} class="core" style={`fill: ${look.core}`} />
    {/if}
  </g>
{/if}

<style>
  .body { pointer-events: none; }
  .band { fill: var(--amber); opacity: 0.6; }
  .ring { fill: none; stroke: var(--amber); stroke-opacity: 0.6; }
  .disc { fill: none; stroke: var(--amber); opacity: 0.8; }
</style>
