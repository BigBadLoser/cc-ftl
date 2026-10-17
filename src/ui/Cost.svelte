<script lang="ts">
  import type { UiApi, UiCost, UiStock } from './api';
  import ItemIcon from './ItemIcon.svelte';

  let { api, cost, stock, size = 18 }: { api: UiApi; cost: UiCost[]; stock?: UiStock[]; size?: number } = $props();
  const have = (item: string) => {
    const s = stock?.find((x) => x.item === item);
    return s ? s.floor + s.stored : 0;
  };
</script>

<span class="cost">
  {#each cost as c (c.item)}
    <span class="c" class:short={stock !== undefined && have(c.item) < c.count} title="{c.name}: have {have(c.item)}">
      <ItemIcon {api} item={c.item} {size} />{c.count}
    </span>
  {/each}
</span>

<style>
  .cost { display: inline-flex; flex-wrap: wrap; gap: 2px 8px; align-items: center; }
  .c { display: inline-flex; align-items: center; gap: 1px; font-size: 12px; }
  .short { color: #ff9a9a; }
</style>
