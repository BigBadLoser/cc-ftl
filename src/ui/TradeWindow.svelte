<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiTrade, UiTradePartner } from './api';
  import FloatingWindow from './FloatingWindow.svelte';
  import { centerTop } from './floatingWindow';
  import TradeDeliveries from './TradeDeliveries.svelte';
  import TradeMarket from './TradeMarket.svelte';
  import TradeSlip from './TradeSlip.svelte';
  import type { Draft } from './tradeDraft';

  /** The one trade window, for a station or a trader ship: movable and pinnable, so it can stay open while shuttles fly. */
  let { api, partner: id, onClose }: { api: UiApi; partner: number; onClose: () => void } = $props();
  let trade = $state<UiTrade>({ credits: 0, partners: [], deals: [] });
  onMount(() => api.trade.subscribe((t) => (trade = t)));
  const p = $derived<UiTradePartner | undefined>(trade.partners.find((x) => x.id === id));
  const deals = $derived(trade.deals.filter((d) => d.ship === id && (d.give || d.get)));
  let draft = $state<Draft>({});
  const fmt = (n: number) => n.toLocaleString('en').replace(/,/g, ' ');
  const refusal: Record<string, string> = {
    hostile: 'They have no interest in talking to you.', weaponsHot: 'Their guns are on you: they will not talk.',
    silent: 'No answer. Nobody is aboard to hear.', noTrade: 'They have nothing to trade.',
  };
  const truceTip = $derived(p?.market?.banned ? 'Truce broken: everyone here fires on you until the ban ends.' : 'Nobody starts a fight here. Firing on or boarding anyone breaks the truce.');
  const marketTip = $derived(p?.market ? `${p.market.names.join(' · ')}. Contraband is bought at ${Math.round(p.market.contrabandRate * 100)}% of its value.${p.market.fence !== null ? ` The fence takes anything at ${Math.round(p.market.fence * 100)}%, no questions.` : ''}` : '');
  const hail = () => api.dispatch({ type: 'trade.hail', ship: id });
</script>

<FloatingWindow id="trade" title="Trade" icon="station" min={{ w: 760, h: 380 }} defaultRect={(b) => centerTop(b, 1010)} {onClose} closeLabel="Close trade window" closeTestId="trade-close" testId="trade-window" titleTestId="trade-heading">
  {#snippet titleExtra()}
    <span class="who" data-testid="trade-title">{p?.name ?? ''}</span>
    <span class="role">{p?.role ?? ''}{p && p.kind === 'ship' && p.distance ? ` · ${p.distance} tiles away` : ''}</span>
    {#if p?.market?.truce}<span class="chip" class:bad={p.market.banned} class:good={!p.market.banned} title={truceTip} data-testid="market-truce">{p.market.banned ? 'TRUCE BROKEN' : 'TRUCE'}</span>{/if}
    {#if p?.market}<span class="chip warn" title={marketTip} data-testid="black-market">BLACK MARKET</span>{/if}
    <span class="credits" title="Your credits" data-testid="trade-credits">₵ {fmt(trade.credits)}</span>
  {/snippet}
  <div class="pane" data-testid="trade-pane">
    {#if !p}
      <p class="msg">They are gone.</p>
    {:else if p.hail === 'none'}
      <div class="msg"><p>No contact yet.</p><button class="act" data-testid="trade-hail" onclick={hail}>Hail {p.name}</button></div>
    {:else if p.hail === 'refused'}
      <div class="msg"><p class="bad" data-testid="trade-refused">{refusal[p.reason] ?? 'They refuse to talk.'}</p><button class="act" data-testid="trade-rehail" onclick={hail}>Hail again</button></div>
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
</FloatingWindow>

<style>
  .who { color: var(--text); white-space: nowrap; }
  .role { color: var(--role-ink); font: 12px var(--head-font); letter-spacing: 0.05em; white-space: nowrap; text-transform: none; }
  .chip { font: 600 11px var(--head-font); letter-spacing: 0.1em; padding: 1px 6px; border: 1px solid var(--line-hi); color: var(--dim); white-space: nowrap; cursor: help; }
  .chip.good { color: var(--green); border-color: var(--green); }
  .chip.bad { color: var(--red); border-color: var(--red); }
  .chip.warn { color: var(--amber); border-color: var(--amber); }
  .credits { margin-left: auto; color: var(--gold); font: 700 14px var(--head-font); letter-spacing: 0.05em; white-space: nowrap; text-transform: none; }
  .pane { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
  .grid { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 290px; }
  .side { display: flex; flex-direction: column; min-height: 0; }
  .msg { padding: 16px; color: var(--dim); display: grid; gap: 8px; justify-items: start; }
  .msg p { margin: 0; }
  .msg .bad { color: var(--red); }
  .act { border-color: var(--cyan); color: var(--cyan); background: transparent; }
</style>
