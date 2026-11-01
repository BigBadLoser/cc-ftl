<script lang="ts">
  /** The info row: fuel, FTL charge, jumps made and the turn as icon + value cells (the look of the ship overview's stat cells). */
  import Icon from './Icon.svelte';
  import type { UiStarmap } from './starmapApi';

  let { map, fuelBad = false, chargeBad = false }: { map: UiStarmap; fuelBad?: boolean; chargeBad?: boolean } = $props();
</script>

<div class="stats" data-testid="starmap-stats">
  <span class="cell" class:bad={fuelBad} title="Fuel" data-testid="starmap-fuel"><Icon name="fuel" size={18} /><b>{map.fuel}</b></span>
  <span class="cell" class:bad={chargeBad} title="FTL charge" data-testid="starmap-charge"><Icon name="bolt" size={18} /><b>{map.charge}/{map.chargeMax}</b><small>s</small></span>
  <span class="cell" title="Jumps made"><Icon name="fast" size={18} /><b>{map.jumps}</b></span>
  <span class="cell" title="Starmap turn (one per hop, and one every 3 minutes of game time)" data-testid="starmap-turn"><Icon name="clock" size={18} /><b>{map.turn}</b><small>turn</small></span>
</div>

<style>
  .stats { display: flex; gap: 4px; flex-wrap: wrap; }
  .cell { display: flex; align-items: center; gap: 6px; padding: 6px 8px; min-height: 20px; background: var(--panel-2); border: 1px solid var(--line); color: var(--cyan); }
  .cell b { color: var(--text); font-weight: 600; }
  .cell small { color: var(--dim); font-size: 11px; }
  .cell.bad { border-color: var(--red); color: var(--red); }
</style>
