<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiIcon } from './api';

  let { api, item, size = 28 }: { api: UiApi; item: string; size?: number } = $props();
  let icons = $state<Record<string, UiIcon>>({});
  onMount(() => api.itemIcons.subscribe((v) => (icons = v)));
  /** A UI icon where it fits at 1x, else the floor-stack frame (an item with no UI icon has only that). */
  const icon = $derived.by(() => {
    const ic = icons[item];
    return ic?.ui && ic.floor && (ic.w > size || ic.h > size) ? ic.floor : ic;
  });
  /** A UI icon: the largest whole-number scale that fits (pixel art stays crisp). A floor frame: the largest scale, down to a fraction. */
  const k = $derived(!icon ? 1 : icon.ui ? Math.max(1, Math.floor(Math.min(size / icon.w, size / icon.h))) : Math.min(size / icon.w, size / icon.h, 2));
</script>

<span class="ic" style:width="{size}px" style:height="{size}px" aria-hidden="true">
  {#if icon}
    <i
      style:width="{icon.w}px" style:height="{icon.h}px" style:transform="scale({k})"
      style:background="url({icon.src}) -{icon.x}px -{icon.y}px / {icon.sheetW}px {icon.sheetH}px no-repeat"
    ></i>
  {/if}
</span>

<style>
  .ic { display: inline-flex; align-items: center; justify-content: center; flex: none; }
  i { display: block; image-rendering: pixelated; flex: none; transform-origin: center; }
</style>
