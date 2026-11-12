<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiTrade, UiTradePartner } from './api';
  import { REFUSAL } from './channel';
  import TradeDeliveries from './TradeDeliveries.svelte';
  import TradeMarket from './TradeMarket.svelte';
  import TradeSlip from './TradeSlip.svelte';
  import type { Draft } from './tradeDraft';

  /** The trade window's content: the market list, the deal slip and the deliveries under way, for one partner. `start` is a deal already on the slip. */
  let { api, partner: id, start = {} }: { api: UiApi; partner: number; start?: Draft } = $props();
  let trade = $state<UiTrade>({ credits: 0, partners: [], deals: [] });
  onMount(() => api.trade.subscribe((t) => (trade = t)));
  const p = $derived<UiTradePartner | undefined>(trade.partners.find((x) => x.id === id));
  const deals = $derived(trade.deals.filter((d) => d.ship === id && (d.give || d.get)));
  // svelte-ignore state_referenced_locally -- only the first value matters: the slip is the player's own after that
  let draft = $state<Draft>({ ...start });
  const hail = () => api.dispatch({ type: 'trade.hail', ship: id });
</script>

<div class="pane" data-testid="trade-pane">
  {#if !p}
    <p class="msg">They are gone.</p>
  {:else if p.hail === 'none'}
    <div class="msg"><p>No contact yet.</p><button class="act" data-testid="trade-hail" onclick={hail}>Hail {p.name}</button></div>
  {:else if p.hail === 'refused'}
    <div class="msg"><p class="bad" data-testid="trade-refused">{REFUSAL[p.reason] ?? 'They refuse to talk.'}</p><button class="act" data-testid="trade-rehail" onclick={hail}>Hail again</button></div>
  {:else}
    <div class="grid" data-testid="trade-answered">
      <TradeMarket {api} {p} credits={trade.free ?? trade.credits} bind:draft locked={!!p.offer} />
      <div class="side">
        <TradeSlip {api} {p} {trade} bind:draft />
        <TradeDeliveries {api} {deals} />
      </div>
    </div>
  {/if}
</div>

<style>
  .pane { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
  .grid { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 290px; }
  .side { display: flex; flex-direction: column; min-height: 0; }
  .msg { padding: 16px; color: var(--dim); display: grid; gap: 8px; justify-items: start; }
  .msg p { margin: 0; }
  .msg .bad { color: var(--red); }
  .act { border-color: var(--cyan); color: var(--cyan); background: transparent; }
</style>
