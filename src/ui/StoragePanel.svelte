<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiItemDef, UiStorage } from './api';
  import ItemIcon from './ItemIcon.svelte';

  let { api, id }: { api: UiApi; id: number } = $props();
  let all = $state<UiStorage[]>([]);
  onMount(() => api.storages.subscribe((v) => (all = v)));
  const s = $derived(all.find((x) => x.id === id));
  const items: UiItemDef[] = $derived(api.items);

  const totals = $derived.by(() => {
    const m: Record<string, number> = {};
    for (const st of s?.stacks ?? []) m[st.item] = (m[st.item] ?? 0) + st.count;
    return Object.entries(m);
  });
  const name = (item: string) => items.find((i) => i.id === item)?.name ?? item;
  const used = $derived(s?.stacks.length ?? 0);
  const pct = $derived(s ? Math.round((used / Math.max(1, s.capacity)) * 100) : 0);
  const allowed = (item: string) => !s || s.filter === null || s.filter.includes(item);
  const set = (list: string[] | null) => api.dispatch({ type: 'storage.setFilter', moduleId: id, items: list });
  function toggle(item: string) {
    if (!s) return;
    const cur = s.filter ?? items.map((i) => i.id);
    const next = cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item];
    set(next.length === items.length ? null : next);
  }
</script>

{#if s}
  <section data-testid="storage-panel">
    <div class="cap">
      <span>Slots <b data-testid="storage-slots">{used}/{s.capacity}</b></span>
      <div class="bar" class:full={pct >= 100}><i style:width="{pct}%"></i></div>
    </div>
    <ul class="contents" data-testid="storage-contents">
      {#each totals as [item, n] (item)}
        <li><ItemIcon {api} {item} size={30} /><span class="n">{name(item)}</span><b>{n}</b></li>
      {:else}
        <li class="empty">Empty</li>
      {/each}
    </ul>
    <div class="fh">
      <span class="lbl">Accepts</span>
      <span class="ab">
        <button data-testid="filter-all" class:on={s.filter === null} onclick={() => set(null)}>All</button>
        <button data-testid="filter-none" class:on={s.filter !== null && s.filter.length === 0} onclick={() => set([])}>None</button>
      </span>
    </div>
    <div class="filters">
      {#each items as it (it.id)}
        <button class="f" class:on={allowed(it.id)} data-testid="filter-{it.id}" aria-pressed={allowed(it.id)} title={it.name} onclick={() => toggle(it.id)}>
          <ItemIcon {api} item={it.id} size={26} /><span>{it.name}</span>
        </button>
      {/each}
    </div>
  </section>
{/if}

<style>
  section { margin-top: 8px; }
  .cap { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: center; color: var(--dim); }
  .cap b { color: var(--text); }
  .bar.full > i { background: #ff9a3c; }
  .contents { list-style: none; margin: 8px 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; }
  .contents li { display: flex; align-items: center; gap: 6px; background: #0e1626; border-radius: 0; padding: 2px 8px 2px 4px; }
  .contents .n { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .contents .empty { color: var(--dim); grid-column: 1 / -1; padding: 6px 8px; }
  .fh { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
  .lbl { color: var(--dim); }
  .ab { display: flex; gap: 4px; }
  .ab button { min-height: 34px; padding: 0 12px; }
  .filters { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 4px; }
  .f { display: flex; align-items: center; gap: 6px; justify-content: flex-start; padding: 0 8px 0 4px; min-height: 40px; opacity: 0.55; text-align: left; }
  .f.on { opacity: 1; }
  .f span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
  @media (max-width: 600px) { .filters, .contents { grid-template-columns: 1fr 1fr 1fr; } .f span:last-child { display: none; } .f { justify-content: center; padding: 0; } }
</style>
