<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi } from './api';

  let { api }: { api: UiApi } = $props();
  let menu = $state<{ x: number; y: number; items: { id: string; label: string }[] } | null>(null);
  let vw = $state(innerWidth);
  let vh = $state(innerHeight);
  onMount(() => api.contextMenu.subscribe((v) => (menu = v)));
  // Keep the menu on screen: it opens down-right of the cursor unless that would run off the edge.
  const left = $derived(menu ? Math.min(menu.x + 6, vw - 190) : 0);
  const top = $derived(menu ? Math.min(menu.y + 6, vh - (menu.items.length * 32 + 12)) : 0);
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />
{#if menu}
  <div class="menu" role="menu" tabindex="-1" data-testid="context-menu" style:left="{left}px" style:top="{top}px" oncontextmenu={(e) => e.preventDefault()}>
    {#each menu.items as it (it.id)}
      <button role="menuitem" data-testid="order-{it.id}" onclick={() => api.pickContext(it.id)}>{it.label}</button>
    {/each}
  </div>
{/if}

<style>
  /* Steel palette: graphite panel, cyan only on the item under the pointer or focus. */
  .menu { position: fixed; z-index: 8; min-width: 170px; background: #0b0e11; border: 1px solid #3a424a; box-shadow: 0 6px 24px #000a; display: grid; padding: 3px; }
  .menu button { text-align: left; min-height: 30px; padding: 0 10px; border-color: transparent; background: transparent; color: #e4e9ee; font-size: 13px; white-space: nowrap; }
  .menu button:hover, .menu button:focus-visible { background: #11151a; border-color: var(--cyan); color: #fff; }
</style>
