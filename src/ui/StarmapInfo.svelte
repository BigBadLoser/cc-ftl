<script lang="ts">
  /**
   * Info card for a sector (zoom level 2) or region (level 3) tapped on the starmap, with a button to zoom in on it and
   * an optional main action (the first jump of a plotted route).
   */
  let { title, color, lines, zoomLabel, onZoom, onClear, action = null, warn = null }: {
    title: string; color: string; lines: string[]; zoomLabel: string; onZoom: () => void; onClear: () => void;
    action?: { label: string; run: () => void } | null; warn?: string | null;
  } = $props();
</script>

<aside class="panel" data-testid="starmap-info">
  <div class="top">
    <h3 style={`color:${color}`}>{title}</h3>
    <button class="x" onclick={onClear} aria-label="Clear selection">✕</button>
  </div>
  {#each lines as l, i (i)}<div class="row" class:dim={i > 0}>{l}</div>{/each}
  {#if warn}<div class="row warn">{warn}</div>{/if}
  <div class="buttons">
    {#if action}<button class="go" onclick={action.run} data-testid="starmap-info-jump">{action.label}</button>{/if}
    <button class="zoom" onclick={onZoom}>{zoomLabel}</button>
  </div>
</aside>

<style>
  .panel { position: fixed; z-index: 12; right: calc(10px + var(--sar)); bottom: calc(10px + var(--sab)); width: min(300px, calc(100vw - 20px)); background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; display: grid; gap: 6px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  h3 { margin: 0; font-size: 15px; letter-spacing: 0.12em; text-transform: uppercase; }
  .row { font-size: 13px; }
  .dim { color: var(--dim); }
  .warn { color: #fca5a5; font-size: 12px; }
  .buttons { display: flex; gap: 6px; }
  .buttons button { flex: 1; }
  .zoom { background: #0e4a56; border-color: var(--cyan); font-weight: 600; }
  .go { background: #4a3a0e; border-color: var(--amber); color: #fde68a; font-weight: 600; }
  .x { min-width: 32px; min-height: 32px; padding: 0; }
  @media (max-width: 600px) {
    .panel { left: 0; right: 0; bottom: 0; width: auto; border-radius: 14px 14px 0 0; border-width: 1px 0 0; padding: 10px 14px calc(12px + var(--sab)); }
  }
</style>
