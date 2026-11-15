<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi } from '../api';
  import Icon from '../Icon.svelte';

  /**
   * A crew portrait; it appears once its sprite sheets load. The one look of a portrait everywhere: `frozen` (a prisoner sealed in a stasis slab) is
   * frosted with a snowflake badge, `dead` is greyed. `size` is the width; the height follows the sprite's proportions.
   */
  let { api, id, size = 28, frozen = false, dead = false }: { api: UiApi; id: number; size?: number; frozen?: boolean; dead?: boolean } = $props();
  let rev = $state(0);
  const pic = $derived((void rev, api.portrait(id)));
  onMount(() => {
    const t = setInterval(() => { if (!pic) rev++; }, 500);
    return () => clearInterval(t);
  });
</script>

<span class="face" class:frost={frozen} class:dead style="width:{size}px;height:{Math.round(size * 1.06)}px" data-testid={frozen ? 'face-frozen' : undefined}
  >{#if pic}<img src={pic} alt="" />{/if}{#if frozen}<span class="fx"></span><span class="badge"><Icon name="snowflake" size={size >= 48 ? 12 : 10} /></span>{/if}</span>

<style>
  .face { position: relative; flex: none; display: inline-block; background: var(--track); border: 1px solid var(--line); overflow: hidden; box-sizing: border-box; }
  img { display: block; width: 100%; height: 100%; image-rendering: pixelated; object-fit: cover; }
  .frost { border-color: #7fdcf0; } .frost img { filter: saturate(.45) brightness(1.05); }
  .dead img { filter: grayscale(1) brightness(0.6); }
  .fx { position: absolute; inset: 0; background: linear-gradient(160deg, rgba(160,225,240,.35), rgba(80,150,170,.1) 60%, rgba(180,235,245,.25)); }
  .badge { position: absolute; right: 2px; bottom: 2px; display: inline-flex; padding: 1px; background: #061a22; color: #7fdcf0; border: 1px solid #2c6878; }
</style>
