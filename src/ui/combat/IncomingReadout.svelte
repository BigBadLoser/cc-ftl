<script lang="ts">
  import type { UiIncoming } from '../api';

  /** Enemy shots committed to or flying at your ship, soonest first. Fixed in place whichever ship the main view shows. */
  let { shots }: { shots: UiIncoming[] } = $props();
</script>

<div class="inc" data-testid="combat-incoming" aria-live="off">
  <b>Incoming</b>
  {#each shots.slice(0, 5) as s, i (i)}<span class:fly={s.flying}>{s.name} <i>{s.eta.toFixed(1)}s</i></span>{/each}
</div>

<style>
  .inc { display: flex; align-items: center; gap: 12px; padding: 3px 10px; background: rgba(60, 12, 18, 0.88); border: 1px solid var(--red); font: 600 12px/1 var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; color: #ffb3b3; white-space: nowrap; }
  b { color: #fff; letter-spacing: 0.1em; }
  i { font-style: normal; font-variant-numeric: tabular-nums; }
  .fly { color: #fff; }
</style>
