<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiStock } from './api';
  import ItemIcon from './ItemIcon.svelte';

  let { api, onClose }: { api: UiApi; onClose: () => void } = $props();
  let stock = $state<UiStock[]>([]);
  onMount(() => api.stock.subscribe((v) => (stock = v)));
  const rows = $derived(api.items.map((it) => ({ it, s: stock.find((x) => x.item === it.id) })));
</script>

<aside class="sheet" data-testid="stock-drawer">
  <div class="top"><h2>Ship stock</h2><button aria-label="Close" onclick={onClose}>×</button></div>
  <div class="head"><span></span><span>Total</span><span>Floor</span><span>Stored</span><span>Carried</span></div>
  <ul>
    {#each rows as { it, s } (it.id)}
      <li class:none={!s} data-testid="stock-{it.id}">
        <span class="nm"><ItemIcon {api} item={it.id} size={30} />{it.name}</span>
        <b data-testid="stock-total-{it.id}">{s ? s.floor + s.stored : 0}</b>
        <span>{s?.floor ?? 0}</span><span>{s?.stored ?? 0}</span><span>{s?.carried ?? 0}</span>
      </li>
    {/each}
  </ul>
</aside>

<style>
  aside { top: calc(var(--hdr) + var(--sat) + 4px); left: 50%; transform: translateX(-50%); width: min(380px, calc(100vw - 16px)); }
  .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  h2 { margin: 0; font-size: 15px; color: var(--cyan); }
  .top button { min-height: 34px; min-width: 34px; padding: 0; font-size: 18px; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  li, .head { display: grid; grid-template-columns: 1fr 52px 48px 52px 56px; align-items: center; text-align: right; gap: 4px; }
  .head { color: var(--dim); font-size: 11px; }
  .nm { display: flex; align-items: center; gap: 6px; text-align: left; }
  li.none { opacity: 0.45; }
  li > span:not(.nm) { color: var(--dim); }
  @media (max-width: 600px) { aside { top: calc(var(--hdr) + var(--sat)); bottom: auto; left: 8px; right: 8px; width: auto; transform: none; border-radius: 0; border-width: 1px; padding: 10px; } }
</style>
