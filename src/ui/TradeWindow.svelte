<script lang="ts">
  import { Chip } from './kit';
  import { onMount } from 'svelte';
  import type { UiApi, UiTrade, UiTradePartner } from './api';
  import FloatingWindow from './FloatingWindow.svelte';
  import { centerTop } from './floatingWindow';
  import TradeView from './TradeView.svelte';

  /** The one trade window, for a station or a trader ship: movable and pinnable, so it can stay open while shuttles fly. */
  let { api, partner: id, onClose }: { api: UiApi; partner: number; onClose: () => void } = $props();
  let trade = $state<UiTrade>({ credits: 0, partners: [], deals: [] });
  onMount(() => api.trade.subscribe((t) => (trade = t)));
  const p = $derived<UiTradePartner | undefined>(trade.partners.find((x) => x.id === id));
  const fmt = (n: number) => n.toLocaleString('en').replace(/,/g, ' ');
  const truceTip = $derived(p?.market?.banned ? 'Truce broken: everyone here fires on you until the ban ends.' : 'Nobody starts a fight here. Firing on or boarding anyone breaks the truce.');
  const marketTip = $derived(p?.market ? `${p.market.names.join(' · ')}. Contraband is bought at ${Math.round(p.market.contrabandRate * 100)}% of its value.${p.market.fence !== null ? ` The fence takes anything at ${Math.round(p.market.fence * 100)}%, no questions.` : ''}` : '');
</script>

<FloatingWindow id="trade" title="Trade" icon="station" min={{ w: 760, h: 380 }} defaultRect={(b) => centerTop(b, 1010)} {onClose} closeLabel="Close trade window" closeTestId="trade-close" testId="trade-window" titleTestId="trade-heading" titleFit>
  {#snippet titleExtra()}
    <span class="who" data-testid="trade-title">{p?.name ?? ''}</span>
    <span class="role">{p?.role ?? ''}{p && p.kind === 'ship' && p.distance ? ` · ${p.distance} tiles away` : ''}</span>
    {#if p?.market?.truce}<Chip tone={p.market.banned ? 'bad' : 'good'} title={truceTip} testId="market-truce">{p.market.banned ? 'TRUCE BROKEN' : 'TRUCE'}</Chip>{/if}
    {#if p?.market}<Chip tone="warn" title={marketTip} testId="black-market">BLACK MARKET</Chip>{/if}
    <span class="credits"><Chip tone="gold" size="md" caps={false} outline={false} title="Your credits" testId="trade-credits">₵ {fmt(trade.credits)}</Chip></span>
  {/snippet}
  <TradeView {api} partner={id} />
</FloatingWindow>

<style>
  .who { color: var(--text); white-space: nowrap; }
  .role { color: var(--role-ink); font: 12px var(--head-font); letter-spacing: 0.05em; white-space: nowrap; text-transform: none; }
  .credits { margin-left: auto; }
</style>
