<script lang="ts">
  import type { UiApi, UiShuttles } from './api';
  import Icon from './Icon.svelte';

  /** The cargo "Base run" order form for one shuttle: from and to as chips, the item as a list, the amount as a stepper. */
  let { api, regions, vehicle }: { api: UiApi; regions: UiShuttles['regions']; vehicle: number } = $props();

  let runFrom = $state(0);
  let runTo = $state(0);
  let runItem = $state('');
  let runQty = $state(10);
  const from = $derived(regions.find((r) => r.id === runFrom) ?? regions[0]);
  const to = $derived(regions.find((r) => r.id === runTo && r.id !== from?.id) ?? regions.find((r) => r.id !== from?.id));
  const item = $derived(from?.stock.find((l) => l.item === runItem) ?? from?.stock[0]);
  const qty = $derived(Math.max(1, Math.min(item?.count ?? 1, Math.round(Number(runQty) || 1))));
  const step = (d: number) => (runQty = Math.max(1, Math.min(item?.count ?? 1, qty + d)));
  const send = () => {
    if (from && to && item) api.dispatch({ type: 'ferry.order', vehicle, from: from.id, to: to.id, items: [{ item: item.item, count: qty }] });
  };
</script>

{#if from && to}
  <div class="run" data-testid="ferry-form-{vehicle}">
    <div class="row">
      <span class="lbl">From</span>
      <div class="chips" role="group" aria-label="From" data-testid="ferry-from">
        {#each regions as r (r.id)}
          <button class:on={r.id === from.id} aria-pressed={r.id === from.id} data-testid="ferry-from-{r.id}" onclick={() => (runFrom = r.id)}>{r.name}</button>
        {/each}
      </div>
    </div>
    <div class="row">
      <span class="lbl">To</span>
      <div class="chips" role="group" aria-label="To" data-testid="ferry-to">
        {#each regions.filter((r) => r.id !== from.id) as r (r.id)}
          <button class:on={r.id === to.id} aria-pressed={r.id === to.id} data-testid="ferry-to-{r.id}" onclick={() => (runTo = r.id)}>{r.name}</button>
        {/each}
      </div>
    </div>
    <div class="row">
      <span class="lbl">Cargo</span>
      <div class="items" role="group" aria-label="Item" data-testid="ferry-item">
        {#each from.stock as l (l.item)}
          <button class:on={l.item === item?.item} aria-pressed={l.item === item?.item} data-testid="ferry-item-{l.item}" onclick={() => (runItem = l.item)}>
            <span>{l.name}</span><small>{l.count}</small>
          </button>
        {:else}
          <span class="none">Nothing stored at {from.name}.</span>
        {/each}
      </div>
    </div>
    <div class="row">
      <span class="lbl">Amount</span>
      <div class="step" role="group" aria-label="Amount">
        <button class="tile" aria-label="Less" disabled={!item || qty <= 1} data-testid="ferry-qty-dec" onclick={() => step(-1)}><Icon name="zoomOut" size={18} /></button>
        <span class="val" data-testid="ferry-qty" aria-live="polite">{item ? qty : 0}<small>/ {item?.count ?? 0}</small></span>
        <button class="tile" aria-label="More" disabled={!item || qty >= item.count} data-testid="ferry-qty-inc" onclick={() => step(1)}><Icon name="zoomIn" size={18} /></button>
        <button class="max" disabled={!item || qty >= item.count} data-testid="ferry-qty-max" onclick={() => item && (runQty = item.count)}>All</button>
      </div>
    </div>
    <button class="go" disabled={!item} data-testid="ferry-send" onclick={send}><Icon name="trade" size={16} /> Send run</button>
  </div>
{/if}

<style>
  .run { display: grid; gap: 6px; background: var(--panel-2); border: 1px solid var(--line); padding: 8px; }
  .row { display: grid; grid-template-columns: 54px 1fr; gap: 8px; align-items: center; }
  .lbl { color: var(--dim); font: 600 12px var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .chips button { background: var(--bg); }
  .chips button.on, .items button.on { background: var(--panel-3); }
  .items { display: grid; gap: 2px; max-height: 148px; overflow-y: auto; touch-action: pan-y; }
  .items button { display: flex; justify-content: space-between; align-items: center; text-align: left; background: var(--bg); }
  .items small { color: var(--dim); font-size: 12px; }
  .items button.on small { color: var(--cyan); }
  .step { display: flex; align-items: center; gap: 4px; }
  .val { min-width: 84px; height: 38px; box-sizing: border-box; display: flex; align-items: baseline; justify-content: center; gap: 4px; padding-top: 8px; background: var(--bg); border: 1px solid var(--line); font: 600 18px var(--head-font); }
  .val small { color: var(--dim); font-size: 12px; font-weight: 400; }
  .step button { background: var(--bg); }
  .max { margin-left: auto; }
  .go { display: flex; align-items: center; justify-content: center; gap: 6px; border-color: var(--cyan); font: 600 15px var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; }
  .none { color: var(--dim); font-size: 12px; }
</style>
