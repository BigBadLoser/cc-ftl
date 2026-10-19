<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiTrade } from './api';

  let { api, onClose, onOpen }: { api: UiApi; onClose: () => void; onOpen: (ship: number) => void } = $props();
  let trade = $state<UiTrade>({ credits: 0, partners: [], deals: [] });
  onMount(() => api.trade.subscribe((t) => (trade = t)));

  function hail(ship: number) {
    api.dispatch({ type: 'trade.hail', ship });
    onOpen(ship);
  }
  const live = $derived(trade.deals.filter((d) => d.live));
</script>

<aside class="sheet" data-testid="trade-list" aria-label="Ships in range">
  <header>
    <strong>Hail a ship</strong>
    <button aria-label="Close" data-testid="trade-list-close" onclick={onClose}>×</button>
  </header>
  {#each trade.partners as p (p.id)}
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
  {:else}
    <p class="none">No other ship or station in this node.</p>
  {/each}
  {#each live as d (d.id)}
    <div class="deal" data-testid="deal-{d.id}"><b>{d.partner}</b> {d.status}</div>
  {/each}
</aside>

<style>
  aside { left: calc(8px + var(--sal)); bottom: calc(8px + var(--sab)); width: 310px; max-height: calc(100vh - var(--hdr) - 24px); overflow-y: auto; }
  header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; color: var(--cyan); }
  header button { min-height: 32px; min-width: 32px; padding: 0 8px; }
  section { padding: 4px 0; border-top: 1px solid var(--line); }
  .top { display: flex; align-items: center; gap: 8px; }
  .nm { flex: 1; min-width: 0; display: grid; line-height: 1.2; }
  .nm small { color: var(--dim); }
  .go { background: #0e4a56; border-color: var(--cyan); }
  .refused { color: #ff9a9a; font-size: 12px; margin-top: 2px; }
  .none { color: var(--dim); margin: 4px 0; }
  .deal { margin-top: 6px; font-size: 12px; color: var(--amber); }
  @media (max-width: 600px) { aside { width: auto; left: 0; bottom: 0; max-height: 46vh; z-index: 8; } }
</style>
