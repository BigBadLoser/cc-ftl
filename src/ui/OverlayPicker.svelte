<script lang="ts">
  import type { UiApi, UiLegend } from './api';
  import Icon from './Icon.svelte';

  let { api }: { api: UiApi } = $props();
  let open = $state(false);
  let current = $state<string | null>(null);
  const legend = $derived<UiLegend | null>(current ? api.overlayLegend(current) : null);

  function pick(id: string | null) {
    current = id;
    open = false;
    api.setOverlay(id);
  }
</script>

<div class="wrap">
  <button class="tile" class:on={current !== null} title="Overlay: {api.overlayList.find((o) => o.id === current)?.label ?? 'Off'}" aria-label="Overlay" data-testid="overlay-btn" onclick={() => (open = !open)}><Icon name="overlay" size={20} /></button>
  {#if open}
    <div class="menu" data-testid="overlay-menu">
      <button class:on={current === null} onclick={() => pick(null)}>Off</button>
      {#each api.overlayList as o (o.id)}
        <button class:on={current === o.id} data-testid="overlay-{o.id}" onclick={() => pick(o.id)}>{o.label}</button>
      {/each}
    </div>
  {/if}
</div>
{#if legend}
  <div class="legend" data-testid="legend">
    <b>{legend.label}</b>
    <span class="grad" style:background="linear-gradient(90deg, {legend.gradient.join(', ')})"></span>
    <span class="ends"><span>{legend.minLabel}</span><span>{legend.maxLabel}</span></span>
  </div>
{/if}

<style>
  .wrap { position: relative; }
  .menu { position: absolute; bottom: 38px; right: 0; z-index: 8; display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; padding: 6px; background: var(--panel); border: 1px solid var(--line); width: 190px; }
  .menu button { padding: 0 6px; }
  .legend { position: fixed; z-index: 4; left: 50%; transform: translateX(-50%); top: calc(var(--hdr) + var(--sat) + 4px); display: grid; gap: 2px; padding: 5px 10px; background: var(--panel); border: 1px solid var(--line); font-size: 12px; min-width: 150px; pointer-events: none; }
  .grad { display: block; height: 8px; }
  .ends { display: flex; justify-content: space-between; color: var(--dim); gap: 12px; }
  @media (max-width: 600px) { .menu { bottom: auto; right: 40px; top: 0; } .legend { top: calc(50px + var(--sat)); left: auto; right: 8px; transform: none; min-width: 120px; padding: 3px 8px; } }
</style>
