<script lang="ts">
  /** A sector's central body (star, gas giant, nebula, black hole...) at (x, y) with radius r, in the caller's units. Colours come from the theme tokens. */
  import { BODY_LOOK } from './starmapStyle';

  let { kind, x, y, r, dim = 1 }: { kind: string; x: number; y: number; r: number; dim?: number } = $props();

  const look = $derived(BODY_LOOK[kind] ?? BODY_LOOK.star!);
</script>

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

<style>
  .body { pointer-events: none; }
  .band { fill: var(--amber); opacity: 0.6; }
  .ring { fill: none; stroke: var(--amber); stroke-opacity: 0.6; }
  .disc { fill: none; stroke: var(--amber); opacity: 0.8; }
</style>
