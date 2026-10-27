<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiToolState, UiYard, UiYardService } from './api';
  import ItemIcon from './ItemIcon.svelte';

  /**
   * A station's Shipyard tab: what the yard offers, the planning view (paint new hull against the ship on the map, add or erase, with the cost,
   * the per-visit cap and the hull against the engines), and the running order with its progress and a Send them home button.
   */
  let { api, station, yard: svc, credits, metal }: { api: UiApi; station: number; yard: UiYardService; credits: number; metal: number } = $props();
  let tool = $state<UiToolState>({ tool: 'select', build: 'module', moduleDef: null, rot: 0 });
  let view = $state<UiYard>({ plan: null, order: null });
  onMount(() => {
    const u = [api.tool.subscribe((t) => (tool = t)), api.yard.subscribe((y) => (view = y))];
    return () => {
      u.forEach((f) => f());
      if (tool.tool === 'yard') leave(); // leaving the tab or the panel ends the planning view
    };
  });
  const planning = $derived(tool.tool === 'yard' && tool.yard?.station === station);
  const plan = $derived(view.plan && view.plan.station === station ? view.plan : null);
  const order = $derived(view.order && view.order.station === station ? view.order : null);
  const live = $derived(!!order?.live);
  const over = $derived(!!plan && plan.hull.capacity > 0 && plan.hull.after > plan.hull.capacity);
  const canOrder = $derived(!!plan && !plan.error && plan.afford.credits && plan.afford.metal && plan.tiles.length > 0);

  function start() {
    api.setTool({ tool: 'yard', yard: { station, erase: false } });
  }
  function leave() {
    api.setTool({ tool: 'select' });
    api.clearYardPaint();
  }
  const setErase = (erase: boolean) => api.setTool({ tool: 'yard', yard: { station, erase } });
  function place() {
    if (!plan || !canOrder) return;
    api.dispatch({ type: 'yard.order', station, tiles: plan.tiles });
    leave();
  }
</script>

<div class="yard" data-testid="yard-pane">
  <div class="offer">
    <b>{svc.size === 'hub' ? 'Hub shipyard' : 'Station shipyard'}</b>
    <span>Builds up to <b>{svc.cap}</b> tiles a visit · from {svc.price.credits} ₵ and {svc.price.metal} metal a tile · ship limit {svc.maxTiles} tiles (yours: {svc.area})</span>
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
    {#if !planning}
      <button class="go" data-testid="yard-plan" onclick={start}>Plan an expansion</button>
      <p class="note">Paint new hull against the ship on the map. The yard builds the floor and the outer walls; you fit it out.</p>
    {:else}
      <div class="card" data-testid="yard-planning">
        <div class="seg" role="group" aria-label="Paint mode">
          <button class:on={!tool.yard?.erase} onclick={() => setErase(false)} data-testid="yard-add">Add</button>
          <button class:on={!!tool.yard?.erase} onclick={() => setErase(true)} data-testid="yard-erase">Erase</button>
          <button onclick={() => api.clearYardPaint()} data-testid="yard-clear">Clear</button>
        </div>
        <p class="note">Drag rectangles on the map, touching the hull.</p>
        <div class="row"><span>Tiles</span><b data-testid="yard-tiles" class:bad={!!plan && plan.tiles.length > plan.cap}>{plan?.tiles.length ?? 0} / {svc.cap}</b></div>
        <div class="row"><span>Cost</span>
          <b data-testid="yard-cost">
            <span class:bad={!!plan && !plan.afford.credits}>{plan?.price.credits ?? 0} ₵</span>
            <span class="metal" class:bad={!!plan && !plan.afford.metal}><ItemIcon {api} item="item.metal" size={16} />{plan?.price.metal ?? 0}</span>
          </b>
        </div>
        <div class="row"><span>You have</span><span>{credits} ₵ · {metal} metal</span></div>
        <div class="row"><span>Ship size</span><span>{plan?.areaAfter ?? svc.area} / {svc.maxTiles}</span></div>
        <div class="row" class:bad={over}><span>Hull</span><b data-testid="yard-hull">{plan && plan.tiles.length ? `${plan.hull.before} → ${plan.hull.after}` : svc.hull.tiles} / {plan?.hull.capacity ?? svc.hull.capacity}</b></div>
        {#if over}<p class="warn" data-testid="yard-over">Over what the engines carry: jumping will need an overcharge.</p>{/if}
        {#if plan?.error && plan.tiles.length}<p class="warn" data-testid="yard-error">{plan.errorText}.</p>{/if}
        <div class="two">
          <button onclick={leave} data-testid="yard-leave">Done</button>
          <button class="go" disabled={!canOrder} onclick={place} data-testid="yard-order-go">Order</button>
        </div>
      </div>
    {/if}
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
  .seg { display: flex; gap: 4px; }
  .seg button { flex: 1; min-height: 30px; }
  .seg button.on { border-color: var(--cyan); background: var(--panel-3); color: var(--text); }
  .two { display: flex; gap: 6px; }
  .two button { flex: 1; }
  button { min-height: 32px; font: 600 13px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; }
  .go { border-color: var(--cyan); background: var(--panel-3); color: var(--text); }
  .go:disabled { opacity: 0.4; }
  .stop { border-color: var(--red); color: var(--red); }
</style>
