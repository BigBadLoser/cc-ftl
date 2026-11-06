<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi } from '../api';

  /** A small crew portrait; it appears once its sprite sheets load. */
  let { api, id, size = 28 }: { api: UiApi; id: number; size?: number } = $props();
  let rev = $state(0);
  const pic = $derived((void rev, api.portrait(id)));
  onMount(() => {
    const t = setInterval(() => { if (!pic) rev++; }, 500);
    return () => clearInterval(t);
  });
</script>

<span class="face" style="width:{size}px;height:{Math.round(size * 1.06)}px">{#if pic}<img src={pic} alt="" />{/if}</span>

<style>
  .face { flex: none; display: inline-block; background: var(--track); border: 1px solid var(--line); overflow: hidden; box-sizing: border-box; }
  img { display: block; width: 100%; height: 100%; image-rendering: pixelated; object-fit: cover; }
</style>
