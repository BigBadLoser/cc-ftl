<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiStats } from './api';

  let { api }: { api: UiApi } = $props();
  let st = $state<UiStats>({ supply: 0, demand: 0, o2: null });
  onMount(() => api.stats.subscribe((s) => (st = s)));

  const short = $derived(st.demand > st.supply);
  const o2Low = $derived(st.o2 !== null && st.o2 < 16);
</script>

<span class="stats" data-testid="stats">
  <span class="chip" class:bad={short} title="Power supply / demand" data-testid="stat-power">⚡ {st.supply}/{st.demand}</span>
  <span class="chip" class:bad={o2Low} title="Average O2 of rooms with crew (kPa)" data-testid="stat-o2">O₂ {st.o2 === null ? '–' : st.o2.toFixed(1)}</span>
</span>

<style>
  .stats { display: flex; gap: 4px; }
  .chip { padding: 6px 9px; border-radius: 8px; background: var(--panel-2); border: 1px solid var(--line); font-size: 13px; white-space: nowrap; }
  .chip.bad { border-color: var(--red); color: #ffb4b4; }
  @media (max-width: 600px) { .stats { flex-basis: 100%; order: 9; justify-content: flex-start; } }
</style>
