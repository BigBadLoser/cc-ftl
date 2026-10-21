<script lang="ts">
  /** A sector's central body (star, gas giant, nebula, black hole...) at (x, y) with radius r, in the caller's units. */
  let { kind, x, y, r, dim = 1 }: { kind: string; x: number; y: number; r: number; dim?: number } = $props();

  const LOOK: Record<string, { core: string; glow: string; halo: number }> = {
    star: { core: '#fde68a', glow: '#fbbf24', halo: 1.9 },
    red_dwarf: { core: '#fca5a5', glow: '#f87171', halo: 1.8 },
    blue_giant: { core: '#dbeafe', glow: '#60a5fa', halo: 2 },
    gas_giant: { core: '#b45309', glow: '#f59e0b', halo: 1.6 },
    nebula: { core: 'none', glow: '#a855f7', halo: 1.8 },
    black_hole: { core: '#000', glow: '#f97316', halo: 1.8 },
  };
  const look = $derived(LOOK[kind] ?? LOOK.star!);
</script>

<g opacity={dim} class="body">
  <circle cx={x} cy={y} r={r * look.halo} fill={`url(#sm-glow-${kind})`} />
  {#if kind === 'gas_giant'}
    <circle cx={x} cy={y} r={r} fill={look.core} />
    <ellipse cx={x} cy={y - r * 0.25} rx={r * 0.95} ry={r * 0.18} fill="#f59e0b" opacity="0.6" />
    <ellipse cx={x} cy={y} rx={r * 1.7} ry={r * 0.35} fill="none" stroke="#fcd34d" stroke-opacity="0.6" stroke-width={r * 0.08} />
  {:else if kind === 'black_hole'}
    <circle cx={x} cy={y} r={r * 1.5} fill="none" stroke="#fb923c" stroke-width={r * 0.35} opacity="0.8" />
    <circle cx={x} cy={y} r={r} fill="#000" />
  {:else if kind !== 'nebula'}
    <circle cx={x} cy={y} r={r} fill={look.core} />
  {/if}
</g>

<style>
  .body { pointer-events: none; }
</style>
