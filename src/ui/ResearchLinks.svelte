<script lang="ts">
  import type { Link } from './researchLayout';

  let { links, width, height, overlay = false }: { links: Link[]; width: number; height: number; overlay?: boolean } = $props();
  const colour = { known: '#3f8a55', open: '#f0b13a', locked: '#333' };
  /** Grey links first, so a coloured link wins where they share a stretch. */
  const ordered = $derived([...links].sort((a, b) => Number(b.tone === 'locked') - Number(a.tone === 'locked')));
</script>

<svg class="links" class:overlay {width} {height} aria-hidden="true">
  {#each ordered as l (l.from + '>' + l.to)}
    <path d={l.d} fill="none" stroke={colour[l.tone]} stroke-width="1.5" stroke-dasharray={l.tone === 'locked' ? '4 3' : undefined} data-link="{l.from}>{l.to}" data-tone={l.tone} />
  {/each}
</svg>

<style>
  .links { position: absolute; left: 0; top: 0; pointer-events: none; }
  .overlay { z-index: 1; }
</style>
