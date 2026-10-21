<script lang="ts">
  import Icon from './Icon.svelte';
  import type { UiShipCombat } from './api';

  let { ship, label = '', compact = false }: { ship: UiShipCombat; label?: string; compact?: boolean } = $props();
  const layers = $derived(Array.from({ length: Math.max(ship.shield.max, ship.shield.layers) }, (_, i) => i < ship.shield.layers));
  const hullPct = $derived(Math.round(ship.integrity * 100));
  const evasionPct = $derived(Math.round(ship.evasion * 100));
</script>

<div class="meters" class:compact data-testid="ship-meters">
  {#if label}<div class="name">{label}<span class="state" class:bad={ship.state !== 'active'}>{ship.state}</span></div>{/if}
  <div class="row">
    <span class="m sh" title="Shield layers; the bar is progress toward the next one" aria-label="Shield {ship.shield.layers} of {ship.shield.max}">
      <Icon name="shield" size={16} />
      <span class="pips" data-testid="shield-pips">
        {#each layers as on, i (i)}<i class:on></i>{/each}
        {#if layers.length === 0}<em>none</em>{/if}
      </span>
      {#if ship.shield.layers < ship.shield.max}
        <span class="bar mini"><i style="width:{Math.round(ship.shield.progress * 100)}%"></i></span>
      {/if}
    </span>
    <span class="m hu" class:low={hullPct < 35} title="Hull integrity" aria-label="Hull {hullPct}%">
      <Icon name="hull" size={16} />
      <span class="bar grow"><i style="width:{hullPct}%"></i></span>
      <b>{hullPct}%</b>
    </span>
    <span class="m ev" title="Chance an incoming shot misses" aria-label="Evasion {evasionPct}%">
      <Icon name="evasion" size={16} /><b>{evasionPct}%</b>
    </span>
  </div>
</div>

<style>
  .meters { display: grid; gap: 3px; font-size: 12px; }
  .name { font: 600 14px/1.2 var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; display: flex; gap: 8px; align-items: baseline; }
  .state { font-weight: 400; font-size: 11px; color: var(--dim); }
  .state.bad { color: var(--amber); }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; }
  .m { display: inline-flex; align-items: center; gap: 6px; color: var(--cyan); }
  .m b { color: var(--text); font-weight: 600; min-width: 2.6em; text-align: right; }
  .hu { flex: 1; min-width: 110px; }
  .hu.low { color: var(--red); } .hu.low .bar > i { background: var(--red); }
  .pips { display: inline-flex; gap: 3px; }
  .pips i { width: 10px; height: 10px; border: 1px solid #3a6f86; background: transparent; }
  .pips i.on { background: #5fe0ff; border-color: #bff3ff; }
  .pips em { color: var(--dim); font-style: normal; }
  .mini { width: 30px; height: 4px; }
  .grow { flex: 1; min-width: 40px; }
  .bar { height: 6px; }
</style>
