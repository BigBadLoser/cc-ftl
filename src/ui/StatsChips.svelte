<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiStats, UiStock } from './api';

  let { api, stockOpen, onStock }: { api: UiApi; stockOpen: boolean; onStock: () => void } = $props();
  let st = $state<UiStats>({ supply: 0, demand: 0, o2: null });
  let stock = $state<UiStock[]>([]);
  onMount(() => {
    const a = api.stats.subscribe((s) => (st = s));
    const b = api.stock.subscribe((v) => (stock = v));
    return () => (a(), b());
  });
  const total = $derived(stock.reduce((n, s) => n + s.floor + s.stored, 0));

  const short = $derived(st.demand > st.supply);
  const o2Low = $derived(st.o2 !== null && st.o2 < 16);
</script>

<span class="stats" data-testid="stats">
  <span class="chip" class:bad={short} title="Power supply / demand" data-testid="stat-power">⚡ {st.supply}/{st.demand}</span>
  <span class="chip" class:bad={o2Low} title="Average O2 of rooms with crew (kPa)" data-testid="stat-o2">O₂ {st.o2 === null ? '–' : st.o2.toFixed(1)}</span>
  <button class="chip stock" class:on={stockOpen} aria-pressed={stockOpen} title="Ship stock" data-testid="stat-stock" onclick={onStock}>▣ {total}</button>
</span>

<style>
  .stats { display: flex; gap: 4px; }
  .chip { padding: 6px 9px; border-radius: 8px; background: var(--panel-2); border: 1px solid var(--line); font-size: 13px; white-space: nowrap; }
  button.chip { min-height: 0; min-width: 0; color: var(--text); font: inherit; font-size: 13px; cursor: pointer; }
  button.chip.on { background: #0e4a56; border-color: var(--cyan); }
  .chip.bad { border-color: var(--red); color: #ffb4b4; }
  @media (max-width: 600px) { .stats { order: 9; gap: 3px; } .chip { padding: 5px 6px; font-size: 12px; } button.chip { font-size: 12px; } }
</style>
