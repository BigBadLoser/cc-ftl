<script lang="ts">
  import type { Slot } from './blocks';
  import type { UiApi } from '../api';
  import ItemIcon from '../ItemIcon.svelte';

  /** An equipment slot grid: a box per slot with the item's icon, name and lines, or an empty (dashed) box; an optional action per slot. */
  let { api, slots, testId }: { api: UiApi; slots: Slot[]; testId?: string } = $props();
</script>

<ul data-testid={testId}>
  {#each slots as g (g.key)}
    <li class:empty={!g.item} class:wide={g.wide} data-testid="slot-{g.key}">
      <span class="box">{#if g.item}<ItemIcon {api} item={g.item.icon} size={40} />{#if g.item.count && g.item.count > 1}<b>{g.item.count}</b>{/if}{/if}</span>
      <span class="info">
        <small>{g.label}</small>
        {#if g.item}
          <span class="name">{g.item.name}{#if g.item.note}<em> {g.item.note}</em>{/if}</span>
          {#each g.item.lines ?? [] as l (l)}<span class="line">{l}</span>{/each}
        {:else}<span class="none">Empty</span>{/if}
      </span>
      {#if g.action}<button disabled={g.action.disabled} data-testid={g.action.testId} onclick={g.action.onClick}>{g.action.label}</button>{/if}
    </li>
  {/each}
</ul>

<style>
  ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  li { display: grid; grid-template-columns: 52px 1fr auto; gap: 8px; align-items: center; padding: 4px; min-height: 60px; background: var(--panel-2); border: 1px solid var(--line); }
  li.wide { grid-column: 1 / 3; }
  .box { position: relative; display: grid; place-items: center; width: 52px; height: 52px; box-sizing: border-box; background: var(--track); border: 1px solid var(--line-hi); }
  li.empty .box { border-style: dashed; border-color: var(--line); background: transparent; }
  .box b { position: absolute; right: 2px; bottom: 1px; font: 600 11px var(--head-font); color: #fff; }
  .info { display: flex; flex-direction: column; min-width: 0; font-size: 12px; }
  small { font: 600 10px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); }
  .name { font: 600 14px var(--head-font); color: var(--text); }
  .name em { font-style: normal; font-size: 11px; color: var(--dim); }
  .line { color: var(--dim); font-size: 11px; }
  .none { color: var(--dim); font-style: italic; }
  button { min-height: 30px; padding: 0 10px; font-size: 12px; }
</style>
