<script lang="ts">
  /**
   * The card for a sector (zoom level 2) or cluster (level 3) tapped on the starmap: a few facts, a button to zoom in on it and
   * an optional main action (the first jump of a plotted route).
   */
  import Icon from './Icon.svelte';
  import PanelHead from './PanelHead.svelte';

  let { title, lines, zoomLabel, onZoom, onClear, action = null, warn = null }: {
    title: string; lines: string[]; zoomLabel: string; onZoom: () => void; onClear: () => void;
    action?: { label: string; run: () => void } | null; warn?: string | null;
  } = $props();
</script>

<aside class="sheet card" data-testid="starmap-info">
  <PanelHead icon="map" {title} onBack={onClear} backIcon="close" backTitle="Close card" backTestId="starmap-card-close" />
  {#each lines as l, i (i)}<div class="row" class:dim={i > 0}>{l}</div>{/each}
  {#if warn}<div class="row warn">{warn}</div>{/if}
  <div class="buttons">
    {#if action}<button class="go" onclick={action.run} data-testid="starmap-info-jump"><Icon name="fast" size={18} />{action.label}</button>{/if}
    <button onclick={onZoom}><Icon name="zoomIn" size={18} />{zoomLabel}</button>
  </div>
</aside>

<style>
  .card { z-index: 12; display: grid; gap: 6px; }
  .row { font-size: 13px; }
  .dim { color: var(--dim); }
  .warn { color: var(--red); font-size: 12px; }
  .buttons { display: flex; gap: 6px; }
  .buttons button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; font: 600 14px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; }
  .go { border-color: var(--cyan); background: var(--panel-3); color: var(--text); }
  @media (min-width: 601px) { .card { left: auto; top: auto; right: calc(10px + var(--sar)); bottom: calc(10px + var(--sab)); width: 300px; } }
</style>
