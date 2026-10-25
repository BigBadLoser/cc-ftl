<script lang="ts">
  import type { UiStationInfo } from './api';
  import Icon from './Icon.svelte';

  let { info }: { info: UiStationInfo } = $props();
  const TIER = { friendly: 'Friendly', neutral: 'Neutral', hostile: 'Hostile' } as const;
  const offers = $derived([
    ...info.services,
    ...(info.jobs ? [`${info.jobs} ${info.jobs === 1 ? 'job' : 'jobs'}`] : []),
    ...(info.hire ? [`${info.hire} for hire`] : []),
  ]);
</script>

<div class="info" data-testid="station-info">
  {#if info.owner}
    <span class="cell wide" class:warn={info.owner.tier === 'hostile'} title="Owner and how they regard you"><Icon name="station" size={18} /><b data-testid="si-owner">{info.owner.name}</b><small>{TIER[info.owner.tier]}</small></span>
  {/if}
  {#if offers.length}
    <span class="cell wide" title="What the station offers"><Icon name="trade" size={18} /><b data-testid="si-services">{offers.join(' · ')}</b></span>
  {/if}
  {#if info.market && (info.market.cheap.length || info.market.dear.length)}
    <span class="cell wide" title="Goods that are cheap or wanted here now"><Icon name="trade" size={18} /><b data-testid="si-market">{#if info.market.cheap.length}Cheap: {info.market.cheap.join(', ')}{/if}{#if info.market.cheap.length && info.market.dear.length} · {/if}{#if info.market.dear.length}Wanted: {info.market.dear.join(', ')}{/if}</b></span>
  {/if}
  <span class="cell" title="Working airlocks to dock at"><Icon name="door" size={18} /><b data-testid="si-docks">{info.docks}</b><small>{info.docks === 1 ? 'dock' : 'docks'}</small></span>
  <span class="cell" title="Guns and shield layers: how well it can hit back"><Icon name="shield" size={18} /><b data-testid="si-defence">{info.guns}</b><small>{info.guns === 1 ? 'gun' : 'guns'}, {info.shields} {info.shields === 1 ? 'shield' : 'shields'}</small></span>
  {#if info.alarm}<span class="cell warn wide" title="The station is on alert"><Icon name="alert" size={18} /><b data-testid="si-alarm">On alert</b><small>{info.alarm}</small></span>{/if}
</div>

<style>
  .info { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 6px; }
  .cell { display: flex; align-items: center; gap: 6px; padding: 6px 8px; background: var(--panel-2); border: 1px solid var(--line); color: var(--cyan); min-height: 20px; }
  .cell b { color: var(--text); font-weight: 600; }
  .cell small { color: var(--dim); font-size: 11px; }
  .cell.warn { border-color: var(--amber); color: var(--amber); }
  .cell.warn small { color: var(--amber); }
  .cell.wide { grid-column: 1 / -1; }
</style>
