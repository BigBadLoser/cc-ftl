<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiTrade } from './api';

  let { api, ship, onOpen }: { api: UiApi; ship: number; onOpen: (ship: number) => void } = $props();
  let trade = $state<UiTrade>({ credits: 0, partners: [], deals: [] });
  onMount(() => api.trade.subscribe((t) => (trade = t)));

  function hail(ship: number) {
    api.dispatch({ type: 'trade.hail', ship });
    onOpen(ship);
  }
  const mine = $derived(trade.partners.filter((p) => p.id === ship));
  const live = $derived(trade.deals.filter((d) => d.live && mine.some((p) => p.id === d.ship)));
</script>

<div data-testid="trade-list" aria-label="Hail">
  {#each mine as p (p.id)}
    <section data-testid="partner-{p.id}">
      <div class="top">
        <span class="nm"><b>{p.name}</b><small>{p.role || 'Unknown ship'}{p.kind === 'ship' ? ` · ${p.distance} tiles` : ' · station'}</small></span>
        {#if p.hail === 'answered'}
          <button class="go" data-testid="partner-trade-{p.id}" onclick={() => onOpen(p.id)}>Trade</button>
        {:else}
          <button data-testid="partner-hail-{p.id}" onclick={() => hail(p.id)}>{p.hail === 'refused' ? 'Hail again' : 'Hail'}</button>
        {/if}
      </div>
      {#if p.hail === 'refused'}<div class="refused" data-testid="partner-refused-{p.id}">No deal: {p.reason === 'weaponsHot' ? 'guns on you' : p.reason === 'silent' ? 'no answer' : 'not interested'}</div>{/if}
    </section>
  {/each}
  {#each live as d (d.id)}
    <div class="deal" data-testid="deal-{d.id}"><b>{d.partner}</b> {d.status}</div>
  {/each}
</div>

<style>
  section { padding: 4px 0; }
  .top { display: flex; align-items: center; gap: 8px; }
  .nm { flex: 1; min-width: 0; display: grid; line-height: 1.2; }
  .nm small { color: var(--dim); }
  .go { background: var(--act-fill); border-color: var(--act-edge); }
  .refused { color: #ff9a9a; font-size: 12px; margin-top: 2px; }
  .deal { margin-top: 6px; font-size: 12px; color: var(--amber); }
</style>
