<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiStats, UiStock } from './api';
  import Icon from './Icon.svelte';

  let { api, stockOpen, onStock }: { api: UiApi; stockOpen: boolean; onStock: () => void } = $props();
  let st = $state<UiStats>({ supply: 0, demand: 0, o2: null });
  let stock = $state<UiStock[]>([]);
  let credits = $state(0);
  onMount(() => {
    const a = api.stats.subscribe((s) => (st = s));
    const b = api.stock.subscribe((v) => (stock = v));
    const c = api.trade.subscribe((v) => (credits = v.credits));
    return () => (a(), b(), c());
  });
  const total = $derived(stock.reduce((n, s) => n + s.floor + s.stored, 0));
  const fuel = $derived(stock.filter((s) => s.item === 'item.fuel').reduce((n, s) => n + s.floor + s.stored, 0));
  const hasFuel = $derived(stock.some((s) => s.item === 'item.fuel'));

  const short = $derived(st.demand > st.supply);
  const o2Low = $derived(st.o2 !== null && st.o2 < 16);
</script>

<!-- Always-relevant resources: a compact grid of icon tiles with the value under the icon. -->
<span class="res" data-testid="stats">
  <span class="cell" class:bad={short} title="Power supply / demand" data-testid="stat-power"><span class="i pw"><Icon name="power" size={16} /></span>{st.supply}/{st.demand}</span>
  <span class="cell" class:bad={o2Low} title="Average O₂ of rooms with crew (kPa)" data-testid="stat-o2"><span class="i o2"><Icon name="o2" size={16} /></span>{st.o2 === null ? '–' : st.o2.toFixed(1)}</span>
  <span class="cell" title="Credits" data-testid="stat-credits"><span class="i cr"><Icon name="credits" size={16} /></span>{credits}</span>
  {#if hasFuel}<span class="cell" class:bad={fuel < 3} title="Fuel" data-testid="stat-fuel"><span class="i fu"><Icon name="fuel" size={16} /></span>{fuel}</span>{/if}
  <button class="cell" class:on={stockOpen} aria-pressed={stockOpen} title="Ship stock" data-testid="stat-stock" onclick={onStock}><span class="i"><Icon name="stock" size={16} /></span>{total}</button>
</span>

<style>
  .res { display: grid; grid-template-rows: repeat(2, 37px); grid-auto-flow: column; grid-auto-columns: 52px; gap: 2px; }
  .cell {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; min-width: 0; min-height: 0; padding: 0;
    background: var(--panel); border: 1px solid var(--line); font: 600 12px/1 var(--head-font); color: var(--text); white-space: nowrap;
  }
  button.cell { cursor: pointer; }
  button.cell.on { border-color: var(--cyan); background: var(--panel-3); }
  .cell.bad { border-color: var(--red); color: #ffc4c4; }
  .i { color: var(--cyan); } .pw { color: #ffd84a; } .o2 { color: #7fd8ff; } .cr { color: var(--amber); } .fu { color: #ff9a4a; }
  @media (max-width: 600px) { .res { grid-template-rows: 34px; grid-auto-columns: 46px; } }
</style>
