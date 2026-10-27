<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiStock } from './api';
  import FloatingWindow from './FloatingWindow.svelte';
  import { centerTop } from './floatingWindow';
  import ItemIcon from './ItemIcon.svelte';
  import TransferSection from './TransferSection.svelte';
  import { Segmented } from './kit';

  let { api, onClose }: { api: UiApi; onClose: () => void } = $props();
  let stock = $state<UiStock[]>([]);
  let queued = $state(0);
  let tab = $state<'stock' | 'transfers'>('stock');
  onMount(() => {
    const u = [api.stock.subscribe((v) => (stock = v)), api.shuttles.subscribe((v) => (queued = v.transfers.length))];
    return () => u.forEach((f) => f());
  });
  const all = $derived(api.items.map((it) => ({ it, s: stock.find((x) => x.item === it.id) })));
  /** Food is always listed first (even at zero), then the other items in stock, then the empty ones. */
  const food = $derived(all.filter((r) => r.it.food));
  const rows = $derived([...all.filter((r) => !r.it.food && r.s), ...all.filter((r) => !r.it.food && !r.s)]);
</script>

<!-- The transfers tab fills the height; the stock list is as tall as its rows. -->
<FloatingWindow id="stock" title="Ship stock" icon="stock" min={{ w: 380, h: 200 }} defaultRect={(b) => centerTop(b, 640, tab === 'transfers' ? b.bottom - b.top : 0)} {onClose} testId="stock-drawer" closeTestId="stock-close" padded>
  <div class="tabs"><Segmented label="Stock view" testId="stock-tabs" value={tab} onChange={(v) => (tab = v as typeof tab)}
    options={[{ value: 'stock', label: 'Stock', testId: 'stock-tab' }, { value: 'transfers', label: queued ? `Transfers (${queued})` : 'Transfers', testId: 'transfers-tab' }]} /></div>
  {#if tab === 'transfers'}
    <TransferSection {api} />
  {:else}
  <div class="head"><span></span><span>Total</span><span>Floor</span><span>Stored</span><span>Carried</span></div>
  <ul>
    <li class="sec">Food</li>
    {#each food as { it, s } (it.id)}
      <li class:out={!s} data-testid="stock-{it.id}">
        <span class="nm"><ItemIcon {api} item={it.id} size={30} />{it.name}</span>
        <b data-testid="stock-total-{it.id}">{s ? s.floor + s.stored : 0}</b>
        <span>{s?.floor ?? 0}</span><span>{s?.stored ?? 0}</span><span>{s?.carried ?? 0}</span>
      </li>
    {/each}
    <li class="sec">Materials and goods</li>
    {#each rows as { it, s } (it.id)}
      <li class:none={!s} data-testid="stock-{it.id}">
        <span class="nm"><ItemIcon {api} item={it.id} size={30} />{it.name}</span>
        <b data-testid="stock-total-{it.id}">{s ? s.floor + s.stored : 0}</b>
        <span>{s?.floor ?? 0}</span><span>{s?.stored ?? 0}</span><span>{s?.carried ?? 0}</span>
      </li>
    {/each}
  </ul>
  {/if}
</FloatingWindow>

<style>
  .tabs { margin-bottom: 8px; flex: none; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  li, .head { display: grid; grid-template-columns: 1fr 52px 48px 52px 56px; align-items: center; text-align: right; gap: 4px; }
  .head { color: var(--dim); font-size: 11px; }
  .nm { display: flex; align-items: center; gap: 6px; text-align: left; }
  li.none { opacity: 0.45; }
  li.out b { color: var(--red); }
  li.sec { display: block; text-align: left; color: var(--cyan); font-size: 12px; margin-top: 4px; }
  li > span:not(.nm) { color: var(--dim); }
</style>
