<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiIcon } from './api';

  let { api, item, size = 28 }: { api: UiApi; item: string; size?: number } = $props();
  let icons = $state<Record<string, UiIcon>>({});
  onMount(() => api.itemIcons.subscribe((v) => (icons = v)));
  const icon = $derived(icons[item]);
  /** Largest scale (down to a fraction) that fits the frame in the box. */
  const k = $derived(icon ? Math.min(size / icon.w, size / icon.h, 2) : 1);
</script>

<span class="ic" class:stand={!!icon?.placeholder} style:--stand={icon?.placeholder} style:width="{size}px" style:height="{size}px" aria-hidden="true" title={icon?.placeholder ? 'Placeholder icon' : undefined}>
  {#if icon}
    <i
      style:width="{icon.w}px" style:height="{icon.h}px" style:transform="scale({k})"
      style:background="url({icon.src}) -{icon.x}px -{icon.y}px / {icon.sheetW}px {icon.sheetH}px no-repeat"
    ></i>
  {/if}
</span>

<style>
  .ic { display: inline-flex; align-items: center; justify-content: center; flex: none; }
  /* PLACEHOLDER icons (a stand-in item's art): a coloured glow and dashed frame mark them until the item has its own. */
  .stand { outline: 1px dashed var(--stand); outline-offset: -1px; border-radius: 3px; }
  .stand i { filter: drop-shadow(0 0 2px var(--stand)); }
  i { display: block; image-rendering: pixelated; flex: none; transform-origin: center; }
</style>
