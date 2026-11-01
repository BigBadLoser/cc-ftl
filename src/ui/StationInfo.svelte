<script lang="ts">
  import type { UiStationInfo } from './api';
  import Icon from './Icon.svelte';

  let { info }: { info: UiStationInfo } = $props();
  const TIER = { friendly: 'Friendly', neutral: 'Neutral', hostile: 'Hostile' } as const;
  /** One chip per service; job and crew counts lead with their number. */
  const offers = $derived<{ n?: number; label: string }[]>([
    ...info.services.map((label) => ({ label })),
    ...(info.jobs ? [{ n: info.jobs, label: info.jobs === 1 ? 'job' : 'jobs' }] : []),
    ...(info.hire ? [{ n: info.hire, label: 'for hire' }] : []),
  ]);
</script>

<div class="info" data-testid="station-info">
  {#if info.owner}
    <span class="cell wide" class:warn={info.owner.tier === 'hostile'} title="Owner and how they regard you"><Icon name="station" size={18} /><b data-testid="si-owner">{info.owner.name}</b><small>{TIER[info.owner.tier]}</small></span>
  {/if}
  {#if offers.length}
    <span class="cell wide" title="What the station offers"><Icon name="trade" size={18} /><span class="chips" data-testid="si-services">{#each offers as o (o.label)}<span class="chip">{#if o.n}<em>{o.n}</em>{/if}{o.label}</span>{/each}</span></span>
  {/if}
  {#if info.hints.length}
    <span class="cell wide" title="Notable stock"><Icon name="list" size={18} /><b data-testid="si-hints">{info.hints.join(' · ')}</b></span>
  {/if}
  {#if info.market && (info.market.cheap.length || info.market.dear.length)}
    <span class="cell wide" title="Goods that are cheap here now (what they sell for) or wanted (what they pay), credits per unit"><Icon name="trade" size={18} /><b data-testid="si-market">{#if info.market.cheap.length}Cheap: {info.market.cheap.map((g) => `${g.name} ${g.price}₵`).join(', ')}{/if}{#if info.market.cheap.length && info.market.dear.length} · {/if}{#if info.market.dear.length}Wanted: {info.market.dear.map((g) => `${g.name} ${g.price}₵`).join(', ')}{/if}</b></span>
  {/if}
  {#if info.prices.length}
    <div class="cell wide prices" data-testid="si-prices" title="Credits per unit now: what the station pays you for one, and what it asks for one. Prices follow its stock.">
      <span class="ph"><Icon name="trade" size={16} /><b>Prices</b><small>they pay</small><small>they ask</small></span>
      {#each info.prices as p (p.name)}
        <span class="pr {p.tone}"><span class="nm">{p.name}{#if p.tone === 'dear'}<small> wanted</small>{:else if p.tone === 'cheap'}<small> plenty</small>{/if}</span><b>{p.buy}₵</b><b class="ask">{p.sell}₵</b></span>
      {/each}
    </div>
  {/if}
  <span class="cell" title="Working airlocks to dock at"><Icon name="door" size={18} /><b data-testid="si-docks">{info.docks}</b><small>{info.docks === 1 ? 'dock' : 'docks'}</small></span>
  <span class="cell" title="Guns and shield layers: how well it can hit back"><Icon name="shield" size={18} /><b data-testid="si-defence">{info.guns}</b><small>{info.guns === 1 ? 'gun' : 'guns'}, {info.shields} {info.shields === 1 ? 'shield' : 'shields'}</small></span>
  {#if info.alarm}<span class="cell warn wide" title="The station is on alert"><Icon name="alert" size={18} /><b data-testid="si-alarm">On alert</b><small>{info.alarm}</small></span>{/if}
</div>

<style>
  .info { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 6px; }
  .cell { display: flex; align-items: center; gap: 6px; padding: 6px 8px; background: var(--panel-2); border: 1px solid var(--line); color: var(--ink-accent); min-height: 20px; }
  .cell b { color: var(--text); font-weight: 600; }
  .cell small { color: var(--dim); font-size: 11px; }
  .cell.warn { border-color: var(--amber); color: var(--amber); }
  .cell.warn small { color: var(--amber); }
  .cell.wide { grid-column: 1 / -1; }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .chip { padding: 1px 7px; border: 1px solid var(--line-hi); background: var(--bg); color: var(--text); font-size: 12px; font-weight: 600; white-space: nowrap; }
  .chip em { font-style: normal; color: var(--amber); margin-right: 4px; }
  .prices { display: grid; gap: 1px; align-items: stretch; }
  .prices .ph, .prices .pr { display: grid; grid-template-columns: 1fr 64px 64px; align-items: center; gap: 6px; }
  .prices .ph { grid-template-columns: auto 1fr 64px 64px; color: var(--ink-accent); padding-bottom: 2px; border-bottom: 1px solid var(--line); margin-bottom: 2px; }
  .prices .ph small, .prices .pr b { text-align: right; }
  .prices .pr { font-size: 12px; color: var(--rest, var(--text)); }
  .prices .pr .ask { color: var(--dim); font-weight: 500; }
  .prices .pr.dear .nm small { color: var(--amber); }
  .prices .pr.cheap .nm small { color: var(--green); }
</style>
