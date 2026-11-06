<script lang="ts">
  import type { UiStationInfo } from './api';

  /** The Station tab (dock control): the price list and what else the dock offers, as a plain table. The owner, docks and defence are on the title bar and sensors already. */
  let { info }: { info: UiStationInfo } = $props();
  const also = $derived(info.services.filter((s) => s !== 'Trade' && s !== 'Blueprints'));
</script>

<div class="dock" data-testid="station-info">
  {#if info.alarm}<p class="alarm" data-testid="si-alarm">On alert: {info.alarm}</p>{/if}
  {#if info.prices.length}
    <table data-testid="si-prices">
      <thead><tr><th>PRICES</th><th>THEY PAY</th><th>THEY ASK</th></tr></thead>
      <tbody>
        {#each info.prices as p (p.name)}
          <tr><td>{p.name}{#if p.tone === 'dear'}<small class="dear"> wanted</small>{:else if p.tone === 'cheap'}<small class="cheap"> plenty</small>{/if}</td><td class="n">₵ {p.buy}</td><td class="n ask">₵ {p.sell}</td></tr>
        {/each}
      </tbody>
    </table>
  {:else}<p class="note">No market here.</p>{/if}
  {#if also.length}<p class="note" data-testid="si-services">Also here: {also.join(' · ')}. Fuel is bought in the trade window.</p>{/if}
</div>

<style>
  .dock { display: grid; gap: 8px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th { text-align: right; font: 600 11px var(--head-font); letter-spacing: 0.12em; color: var(--dim); padding: 0 0 4px; }
  th:first-child { text-align: left; }
  td { padding: 3px 0; }
  .n { text-align: right; color: var(--gold); }
  .ask { color: var(--dim); }
  small.dear { color: var(--amber); } small.cheap { color: var(--green); }
  .alarm { margin: 0; color: var(--amber); }
  .note { margin: 0; color: var(--dim); font-size: 12px; }
</style>
