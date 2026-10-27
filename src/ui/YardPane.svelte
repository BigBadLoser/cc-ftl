<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiYard, UiYardService } from './api';
  import ItemIcon from './ItemIcon.svelte';

  /**
   * A station's Shipyard tab: what the yard offers, its quote for the hull plan (the plan is drawn in the build tools' Hull plan, anywhere; here the
   * yard prices what it can build on this visit and you buy it), and the running order with its progress and a Send them home button.
   */
  let { api, station, yard: svc, credits, metal }: { api: UiApi; station: number; yard: UiYardService; credits: number; metal: number } = $props();
  let view = $state<UiYard>({ plan: { ship: 0, tiles: [], connected: [], loose: [], blocked: [], floor: [], hull: { now: 0, afterAll: 0, capacity: 0, max: 0 } }, quote: null, order: null });
  onMount(() => {
    api.watchYard(station);
    const u = api.yard.subscribe((y) => (view = y));
    return () => {
      u();
      api.watchYard(0);
    };
  });
  const quote = $derived(view.quote && view.quote.station === station ? view.quote : null);
  const order = $derived(view.order && view.order.station === station ? view.order : null);
  const live = $derived(!!order?.live);
  const planned = $derived(view.plan.tiles.length);
  const over = $derived(!!quote && quote.hull.capacity > 0 && quote.hull.after > quote.hull.capacity);
  const canBuy = $derived(!!quote && !quote.error && quote.afford.credits && quote.afford.metal && quote.buy > 0);
  const buy = () => canBuy && api.dispatch({ type: 'yard.order', station });
</script>

<div class="yard" data-testid="yard-pane">
  <div class="offer">
    <b>{svc.size === 'hub' ? 'Hub shipyard' : 'Station shipyard'}</b>
    <span>Builds up to <b>{svc.cap}</b> hull tiles a visit · {svc.price.credits} ₵ and {svc.price.metal} metal a tile, floor inside included · ship limit {svc.hull.max} hull tiles</span>
  </div>

  {#if order}
    <div class="card" data-testid="yard-order" data-phase={order.phase}>
      <div class="row"><b>{order.status}</b><span>{order.built} / {order.total} tiles</span></div>
      <div class="bar" role="progressbar" aria-valuemin={0} aria-valuemax={order.total} aria-valuenow={order.built}><i style={`width: ${order.total ? Math.min(100, (order.built / order.total) * 100) : 0}%`}></i></div>
      {#if live}
        <p class="note">The station's shuttle brings a crew who work in suits on the hull. Your crew can help. Leaving early sends them home and refunds the unbuilt part.</p>
        <button class="stop" data-testid="yard-cancel" onclick={() => api.dispatch({ type: 'yard.cancel', order: order.id })}>Send the crew home</button>
      {:else if order.reason}<p class="note">{order.reason}.</p>{/if}
    </div>
  {/if}

  {#if !live}
    <div class="card" data-testid="yard-quote">
      {#if !planned}
        <p class="note" data-testid="yard-noplan">No hull planned. Draw the outline with Build → Hull plan, any time, then buy it at a yard.</p>
      {:else if quote}
        <div class="row"><span>Planned</span><b data-testid="yard-planned">{quote.planned} hull tiles</b></div>
        <div class="row"><span>This visit</span><b data-testid="yard-tiles" class:bad={quote.buy === 0}>{quote.buy} / {quote.cap} hull tiles{quote.floor ? ` + ${quote.floor} floor` : ''}</b></div>
        <div class="row"><span>Cost</span>
          <b data-testid="yard-cost">
            <span class:bad={!quote.afford.credits}>{quote.price.credits} ₵</span>
            <span class="metal" class:bad={!quote.afford.metal}><ItemIcon {api} item="item.metal" size={16} />{quote.price.metal}</span>
          </b>
        </div>
        <div class="row"><span>You have</span><span>{credits} ₵ · {metal} metal</span></div>
        <div class="row" class:bad={over}><span>Hull</span><b data-testid="yard-hull">{quote.hull.before} → {quote.hull.after} / {quote.hull.capacity}</b></div>
        {#if over}<p class="warn" data-testid="yard-over">Over what the engines carry: jumping will need an overcharge.</p>{/if}
        {#if quote.error}<p class="warn" data-testid="yard-error">{quote.errorText}.</p>{/if}
        {#if quote.rest > 0 && !quote.error}<p class="note">{quote.rest} more stay planned for the next yard.</p>{/if}
        <button class="go" disabled={!canBuy} onclick={buy} data-testid="yard-buy">Buy hull</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .yard { display: grid; gap: 8px; }
  .offer { display: grid; gap: 2px; padding: 8px; background: var(--panel-2); border: 1px solid var(--line); font-size: 12px; color: var(--dim); }
  .offer b { color: var(--text); font-weight: 600; }
  .card { display: grid; gap: 6px; padding: 8px; background: var(--panel-2); border: 1px solid var(--line); }
  .row { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 13px; }
  .row span:first-child { color: var(--dim); }
  .row b { color: var(--text); font-weight: 600; display: inline-flex; gap: 10px; align-items: center; }
  .metal { display: inline-flex; align-items: center; gap: 2px; }
  .bad { color: var(--red) !important; }
  .warn { color: var(--red); font-size: 12px; margin: 0; }
  .note { color: var(--dim); font-size: 12px; margin: 0; }
  .bar { height: 8px; background: var(--bg); border: 1px solid var(--line); }
  .bar i { display: block; height: 100%; background: var(--cyan); }
  button { min-height: 32px; font: 600 13px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; }
  .go { border-color: var(--cyan); background: var(--panel-3); color: var(--text); }
  .go:disabled { opacity: 0.4; }
  .stop { border-color: var(--red); color: var(--red); }
</style>
