<script lang="ts">
  import type { Slot } from './blocks';
  import type { UiApi } from '../api';
  import Icon, { type IconName } from '../Icon.svelte';
  import ItemIcon from '../ItemIcon.svelte';
  import ItemCard from './ItemCard.svelte';

  /**
   * One equipment slot: optional caption above, a square box with the item's sprite (count in the corner) or the slot's faint
   * glyph when empty, the name under it, an optional action; hovering a filled slot opens the item's stats card on `cardAt`.
   */
  let { api, slot, size = 56, caption = true, sub, cardAt = 'right' }: {
    api: UiApi; slot: Slot; size?: number; caption?: boolean; sub?: string; cardAt?: 'right' | 'left' | 'above';
  } = $props();
  let hover = $state(false);
</script>

<div class="slot" style:width="{size + 28}px" data-testid="slot-{slot.key}">
  {#if caption}<span class="cap">{slot.label}</span>{/if}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="box" class:empty={!slot.item} style:width="{size}px" style:height="{size}px" onpointerenter={() => (hover = true)} onpointerleave={() => (hover = false)}>
    {#if slot.item}
      <ItemIcon {api} item={slot.item.icon} size={size - 16} />
      {#if slot.item.count && slot.item.count > 1}<b>{slot.item.count}</b>{/if}
    {:else}
      <span class="glyph"><Icon name={slot.glyph as IconName} size={Math.round(size * 0.42)} /></span>
    {/if}
    {#if hover && slot.item?.card}<div class="pop {cardAt}"><ItemCard card={slot.item.card} /></div>{/if}
  </div>
  <span class="name" class:dim={!slot.item}>{slot.item ? slot.item.name : 'Empty'}{#if slot.item?.note} <small>{slot.item.note}</small>{/if}</span>
  {#if sub}<span class="sub">{sub}</span>{/if}
  {#if slot.action}<button disabled={slot.action.disabled} data-testid={slot.action.testId} onclick={slot.action.onClick}>{slot.action.label}</button>{/if}
</div>

<style>
  .slot { display: grid; justify-items: center; gap: 3px; text-align: center; }
  .cap { color: var(--dim); font: 600 11px var(--head-font); letter-spacing: 0.1em; text-transform: uppercase; }
  .box { position: relative; display: grid; place-items: center; box-sizing: border-box; background: var(--track); border: 1px solid var(--cyan); }
  .box.empty { border-color: var(--line-hi); background: var(--panel-2); }
  .glyph { color: var(--line-hi); opacity: 0.9; }
  .box b { position: absolute; right: 3px; bottom: 1px; font: 600 11px var(--head-font); color: #fff; }
  .name { font-size: 12px; color: var(--text); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .name.dim { color: var(--dim); }
  .name small, .sub { font-size: 11px; color: var(--dim); }
  button { min-height: 24px; min-width: 0; width: 64px; padding: 0 8px; font-size: 11px; }
  .pop { position: absolute; z-index: 20; pointer-events: none; }
  .pop.right { left: calc(100% + 4px); top: -24px; }
  .pop.left { right: calc(100% + 4px); top: -24px; }
  .pop.above { left: 0; bottom: calc(100% + 4px); }
</style>
