<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import type { UiApi, UiTool, UiToolState } from './api';
  import Icon, { type IconName } from './Icon.svelte';

  let { api, children }: { api: UiApi; children?: Snippet } = $props();
  let st = $state<UiToolState>({ tool: 'select', build: 'module', moduleDef: null, rot: 0 });

  onMount(() => api.tool.subscribe((t) => (st = t)));
  // The build catalog fits itself to the left of the dock (the dock never moves).
  let dockW = $state(0);
  $effect(() => { document.documentElement.style.setProperty('--tools-w', `${dockW}px`); return () => document.documentElement.style.removeProperty('--tools-w'); });

  const tools: { id: UiTool; label: string; icon: IconName }[] = [
    { id: 'select', label: 'Select', icon: 'select' },
    { id: 'build', label: 'Build', icon: 'wrench' },
    { id: 'deconstruct', label: 'Deconstruct', icon: 'trash' },
    { id: 'cancel', label: 'Cancel jobs', icon: 'close' },
  ];
</script>

<div class="tools" data-testid="toolbar">
  <div class="dock" bind:offsetWidth={dockW}>
    {#each tools as t (t.id)}
      <button class="tile tool" class:on={st.tool === t.id} title={t.label} aria-label={t.label} data-testid="tool-{t.id}" onclick={() => api.setTool({ tool: t.id })}><Icon name={t.icon} size={18} /></button>
    {/each}
    {#if children}<span class="sep"></span>{@render children()}{/if}
  </div>
</div>

<style>
  /* Bottom-right dock: build tools first, then view options and contextual panels. */
  .tools { position: fixed; z-index: 4; right: calc(8px + var(--sar)); bottom: calc(8px + var(--sab)); display: flex; flex-direction: column; align-items: flex-end; gap: 4px; pointer-events: none; }
  :global(html[data-combat]) .tools { right: calc(388px + var(--sar)); }
  /* Two rows of four: the view group on top, the tools below (no divider; the divider is only for the phone column). */
  .dock { display: grid; grid-template-columns: repeat(4, 32px); gap: 2px; pointer-events: auto; padding: 2px; background: var(--panel); border: 1px solid var(--line); max-width: calc(100vw - 16px); }
  .dock :global(button.tile) { width: 32px; height: 32px; background: var(--panel-2); }
  .dock :global(button.tile.on) { background: var(--panel-3); }
  .dock > .tool { order: 1; }
  .sep { display: none; }
  @media (max-width: 600px) {
    /* A narrow column on the right edge; the selection sheet leaves this strip free. */
    .tools { flex-direction: row-reverse; align-items: flex-start; top: calc(var(--hdr) + 6px + var(--sat)); bottom: auto; }
    :global(html[data-combat]) .tools { display: none; }
    .dock { display: flex; flex-direction: column; flex-wrap: nowrap; width: 38px; box-sizing: border-box; align-items: center; }
    .dock :global(button.tile) { width: 34px; height: 34px; }
    .dock > .tool { order: 0; }
    .sep { display: block; width: auto; height: 1px; align-self: stretch; margin: 3px 2px; background: var(--line); }
  }
</style>
