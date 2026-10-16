<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCrew } from './api';

  let { api }: { api: UiApi } = $props();
  let crew = $state<UiCrew[]>([]);
  let sel = $state<number | null>(null);

  onMount(() => {
    const a = api.crew.subscribe((c) => (crew = c));
    const b = api.selectedCrew.subscribe((s) => (sel = s));
    return () => (a(), b());
  });
</script>

<nav data-testid="crewbar">
  {#each crew as c (c.id)}
    <button class="chip" class:on={sel === c.id} data-testid="crew-chip" onclick={() => api.selectCrew(c.id, true)}>
      <span class="name">{c.name}</span>
      <span class="act">{c.drafted ? 'Drafted' : c.job ? 'Working' : c.activity}</span>
      <span class="bar"><i style:width="{c.rest}%"></i></span>
    </button>
  {/each}
</nav>

<style>
  nav {
    position: fixed; left: 0; right: 0; top: calc(56px + var(--sat)); display: flex; gap: 6px; overflow-x: auto;
    padding: 0 calc(8px + var(--sar)) 4px calc(8px + var(--sal)); pointer-events: none; scrollbar-width: none;
  }
  .chip { flex: none; display: grid; gap: 1px; width: 104px; padding: 3px 8px; text-align: left; line-height: 1.2; pointer-events: auto; background: var(--panel); }
  .name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .act { font-size: 11px; color: var(--dim); text-transform: capitalize; }
  .chip .bar { margin-top: 2px; }
</style>
