<script lang="ts">
  import type { UiShipCombat } from './api';

  let { ship, label = '', compact = false }: { ship: UiShipCombat; label?: string; compact?: boolean } = $props();
  const layers = $derived(Array.from({ length: Math.max(ship.shield.max, ship.shield.layers) }, (_, i) => i < ship.shield.layers));
  const hullPct = $derived(Math.round(ship.integrity * 100));
</script>

<div class="meters" class:compact data-testid="ship-meters">
  {#if label}<div class="name">{label}<span class="state" class:bad={ship.state !== 'active'}>{ship.state}</span></div>{/if}
  <div class="row" title="Shield layers; the bar is progress toward the next one">
    <span class="k">Shield</span>
    <span class="pips" data-testid="shield-pips">
      {#each layers as on, i (i)}<i class:on></i>{/each}
      {#if layers.length === 0}<em>none</em>{/if}
    </span>
    {#if ship.shield.layers < ship.shield.max}
      <span class="bar mini"><i style="width:{Math.round(ship.shield.progress * 100)}%"></i></span>
    {/if}
  </div>
  <div class="row">
    <span class="k">Hull</span>
    <span class="bar grow" class:low={hullPct < 35}><i style="width:{hullPct}%"></i></span>
    <span class="v">{hullPct}%</span>
  </div>
  <div class="row" title="Chance an incoming shot misses">
    <span class="k">Evasion</span><span class="v">{Math.round(ship.evasion * 100)}%</span>
  </div>
</div>

<style>
  .meters { display: grid; gap: 3px; font-size: 12px; }
  .compact { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; }
  .compact .name { flex-basis: 100%; }
  .compact .grow { min-width: 70px; }
  .compact .k { min-width: 0; }
  .name { font-weight: 600; font-size: 13px; display: flex; gap: 8px; align-items: baseline; }
  .state { font-weight: 400; font-size: 11px; color: var(--dim); text-transform: uppercase; }
  .state.bad { color: var(--amber); }
  .row { display: flex; align-items: center; gap: 6px; }
  .k { color: var(--dim); min-width: 52px; }
  .v { min-width: 2.6em; text-align: right; }
  .pips { display: inline-flex; gap: 3px; }
  .pips i { width: 12px; height: 12px; border-radius: 50%; border: 1px solid #3a6f86; background: transparent; }
  .pips i.on { background: #5fe0ff; border-color: #bff3ff; box-shadow: 0 0 6px #22d3ee; }
  .pips em { color: var(--dim); font-style: normal; }
  .mini { width: 34px; height: 4px; }
  .grow { flex: 1; min-width: 40px; }
  .bar.low > i { background: var(--red); }
</style>
