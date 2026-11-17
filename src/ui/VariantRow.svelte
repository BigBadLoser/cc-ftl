<script lang="ts">
  import type { UiThumb } from './api';
  import type { VariantChip } from './buildCatalog';
  import Icon from './Icon.svelte';

  let { chips, onpick, thumbOf }: {
    chips: VariantChip[]; onpick: (id: string) => void;
    /** A module's thumb (the art on a chip that has a `thumbId`). */
    thumbOf?: (id: string, rot: number) => UiThumb | undefined;
  } = $props();
</script>

{#if chips.length > 1}
  <div class="vars" data-testid="popover-variants">
    {#each chips as v (v.id)}
      <button class="v" class:on={v.on} class:lock={v.locked} data-testid="variant-{v.id}" aria-pressed={v.on} onclick={() => onpick(v.id)}>
        {#if v.locked}<Icon name="lock" size={12} />{/if}
        {#if v.thumbId}{@const vt = thumbOf?.(v.thumbId, 0)}{#if vt && vt.w}<img src={vt.url} alt="" draggable="false" />{/if}{/if}
        <span>{v.label}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .vars { display: flex; gap: 4px; margin-top: 6px; }
  .v { flex: 1; height: 40px; min-height: 0; padding: 0 4px; display: flex; align-items: center; justify-content: center; gap: 4px; border: 1px solid var(--build-line); background: var(--build-fill-2); font-size: 12px; color: var(--build-ink); }
  .v img { max-width: 34px; max-height: 32px; image-rendering: pixelated; }
  .v span { text-transform: uppercase; }
  .v.lock { color: #7a7a7a; border-style: dashed; }
  .v.on { border-color: var(--amber); background: var(--build-bg-solid); color: var(--amber); }
</style>
