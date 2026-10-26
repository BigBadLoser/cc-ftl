<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiTrade, UiTradePartner } from './api';
  import TradePane from './TradePane.svelte';

  let { api, partner: id, onClose }: { api: UiApi; partner: number; onClose: () => void } = $props();
  let trade = $state<UiTrade>({ credits: 0, partners: [], deals: [] });
  onMount(() => api.trade.subscribe((t) => (trade = t)));
  const p = $derived<UiTradePartner | undefined>(trade.partners.find((x) => x.id === id));
</script>

<div class="veil" data-testid="trade-window">
  <div class="card" role="dialog" aria-modal="true" aria-label="Trade">
    <header>
      <div class="who">
        <h2 data-testid="trade-title">{p?.name ?? 'Trade'}</h2>
        <small>{p?.role ?? ''}{p && p.kind === 'ship' ? ` · ${p.distance} tiles away` : ''}</small>
      </div>
      <span class="chip" data-testid="trade-credits" title="Your credits">₵ {trade.credits}</span>
      <button aria-label="Close trade window" data-testid="trade-close" onclick={onClose}>×</button>
    </header>
    <TradePane {api} partner={id} {trade} />
  </div>
</div>

<style>
  .veil { position: fixed; inset: 0; z-index: 25; background: rgba(4, 8, 14, 0.5); display: grid; place-items: center; padding: 12px; touch-action: none; }
  .card { box-sizing: border-box; width: min(760px, 100%); max-height: calc(100dvh - 24px); display: flex; flex-direction: column; overflow: hidden; touch-action: pan-y; background: var(--panel-2); border: 1px solid var(--cyan); border-radius: 0; padding: 14px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6); }
  header { flex: none; display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .who { flex: 1; min-width: 0; }
  h2 { margin: 0; font-size: 18px; color: var(--cyan); }
  .who small { color: var(--dim); }
  .chip { padding: 5px 10px; border-radius: 0; background: var(--bg); border: 1px solid var(--line); color: var(--amber); white-space: nowrap; }
  header button { min-width: 36px; min-height: 36px; padding: 0; font-size: 18px; }
  @media (max-width: 600px) {
    .veil { place-items: end stretch; padding: 0; }
    .card { width: 100%; max-height: 88dvh; border-radius: 0; border-width: 1px 0 0; padding: 12px 12px calc(12px + var(--sab)); }
  }
</style>
