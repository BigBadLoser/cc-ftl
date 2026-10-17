<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiStock, UiToolState } from './api';
  import Cost from './Cost.svelte';

  let { api }: { api: UiApi } = $props();
  let st = $state<UiToolState>({ tool: 'select', build: 'wall', moduleDef: null, rot: 0 });
  let stock = $state<UiStock[]>([]);
  onMount(() => {
    const a = api.tool.subscribe((t) => (st = t));
    const c = api.stock.subscribe((v) => (stock = v));
    return () => (a(), c());
  });
  const have = (item: string) => stock.reduce((n, s) => (s.item === item ? n + s.floor + s.stored : n), 0);
  const missing = (d: (typeof api.moduleDefs)[number]) => d.cost.filter((c) => have(c.item) < c.count);
  const power = (p: number) => (p > 0 ? `+${p}⚡` : p < 0 ? `${p}⚡` : '');
</script>

<aside class="sheet" data-testid="build-modules">
  <div class="top">
    <h2>Modules</h2>
    <button data-testid="rotate" onclick={() => api.setTool({ rot: (st.rot + 1) % 4 })}>Rotate (R) {st.rot * 90}°</button>
  </div>
  <div class="list">
    {#each api.moduleDefs as d (d.id)}
      {@const miss = missing(d)}
      <button class="item" class:on={st.moduleDef === d.id} class:short={miss.length > 0} data-testid="mod-{d.id}" data-short={miss.length > 0} onclick={() => api.setTool({ moduleDef: d.id })}
        title={miss.length ? `Missing ${miss.map((c) => `${c.count - have(c.item)} ${c.name}`).join(', ')}` : 'In stock'}>
        <span class="n">{d.name}</span>
        <span class="m">{d.w}×{d.h} <b>{power(d.power)}</b></span>
        <Cost {api} cost={d.cost} {stock} />
        {#if miss.length}<span class="flag">Missing {miss.map((c) => `${c.count - have(c.item)} ${c.name}`).join(', ')}</span>{/if}
      </button>
    {/each}
  </div>
  <p class="hint">{st.moduleDef ? 'Drag or move to position, release or click to place.' : 'Pick a module.'}</p>
</aside>

<style>
  aside { left: calc(8px + var(--sal)); bottom: calc(8px + var(--sab)); width: 340px; max-height: calc(100vh - var(--hdr) - 24px); overflow-y: auto; }
  .top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; gap: 8px; }
  h2 { margin: 0; font-size: 15px; color: var(--cyan); }
  .top button { font-size: 12px; min-height: 34px; }
  .list { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .item { display: grid; text-align: left; padding: 4px 8px; line-height: 1.25; gap: 1px; align-content: start; }
  .item.short { opacity: 0.72; border-color: #7a3a3a; }
  .item.short.on { opacity: 1; }
  .flag { color: #ff9a9a; font-size: 11px; line-height: 1.2; }
  .m { font-size: 12px; color: var(--dim); }
  .m b { color: var(--cyan); font-weight: 600; margin-left: 4px; }
  .hint { margin: 6px 0 0; color: var(--dim); font-size: 12px; }
  @media (max-width: 600px) { aside { width: auto; left: 0; bottom: 0; max-height: 62vh; } .list { grid-template-columns: repeat(2, 1fr); } }
</style>
