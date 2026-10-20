<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import type { UiApi, UiBuildKind, UiStock, UiTool, UiToolState } from './api';
  import Cost from './Cost.svelte';
  import Icon, { type IconName } from './Icon.svelte';

  let { api, children }: { api: UiApi; children?: Snippet } = $props();
  let st = $state<UiToolState>({ tool: 'select', build: 'wall', moduleDef: null, rot: 0 });

  let stock = $state<UiStock[]>([]);
  onMount(() => {
    const a = api.tool.subscribe((t) => (st = t));
    const b = api.stock.subscribe((v) => (stock = v));
    return () => (a(), b());
  });
  const have = (item: string) => stock.reduce((n, s) => (s.item === item ? n + s.floor + s.stored : n), 0);
  const short = (k: UiBuildKind) => (api.structCosts[k] ?? []).some((c) => have(c.item) < c.count);

  const tools: { id: UiTool; label: string; icon: IconName }[] = [
    { id: 'select', label: 'Select', icon: 'select' },
    { id: 'build', label: 'Build', icon: 'wrench' },
    { id: 'deconstruct', label: 'Deconstruct', icon: 'trash' },
    { id: 'cancel', label: 'Cancel jobs', icon: 'close' },
  ];
  const kinds: { id: UiBuildKind; label: string; icon: IconName }[] = [
    { id: 'wall', label: 'Wall', icon: 'wall' },
    { id: 'floor', label: 'Floor', icon: 'floor' },
    { id: 'door', label: 'Door', icon: 'door' },
    { id: 'module', label: 'Modules', icon: 'module' },
  ];
</script>

<div class="tools" data-testid="toolbar">
  {#if st.tool === 'build'}
    <div class="subs">
      {#each kinds as k (k.id)}
        <button class="sub" title={k.label} aria-label={k.label} class:on={st.build === k.id} class:short={k.id !== 'module' && short(k.id)} data-testid="build-{k.id}" onclick={() => api.setTool({ build: k.id })}>
          <Icon name={k.icon} size={18} />
          {#if k.id !== 'module' && api.structCosts[k.id]}<Cost {api} cost={api.structCosts[k.id] ?? []} {stock} size={14} />{/if}
        </button>
      {/each}
    </div>
  {/if}
  <div class="dock">
    {#each tools as t (t.id)}
      <button class="tile" class:on={st.tool === t.id} title={t.label} aria-label={t.label} data-testid="tool-{t.id}" onclick={() => api.setTool({ tool: t.id })}><Icon name={t.icon} size={18} /></button>
    {/each}
    {#if children}<span class="sep"></span>{@render children()}{/if}
  </div>
</div>

<style>
  /* Bottom-right dock: build tools first, then view options and contextual panels. */
  .tools { position: fixed; z-index: 4; right: calc(8px + var(--sar)); bottom: calc(8px + var(--sab)); display: flex; flex-direction: column; align-items: flex-end; gap: 4px; pointer-events: none; }
  :global(html[data-combat]) .tools { right: calc(388px + var(--sar)); }
  .dock, .subs { display: flex; gap: 2px; pointer-events: auto; flex-wrap: wrap; justify-content: flex-end; }
  .dock { padding: 2px; background: var(--panel); border: 1px solid var(--line); max-width: calc(100vw - 16px); }
  .dock :global(button.tile) { width: 32px; height: 32px; background: var(--panel-2); }
  .dock :global(button.tile.on) { background: var(--panel-3); }
  .sep { width: 1px; background: var(--line); margin: 2px 3px; }
  .sub { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; min-width: 44px; min-height: 36px; padding: 3px 4px; color: var(--cyan); background: var(--panel); }
  .sub.on { color: #fff; background: var(--panel-3); }
  .sub.short { border-color: var(--red); }
  @media (max-width: 600px) {
    /* A narrow column on the right edge; the selection sheet leaves this strip free. */
    .tools { flex-direction: row-reverse; align-items: flex-start; top: calc(var(--hdr) + 6px + var(--sat)); bottom: auto; }
    :global(html[data-combat]) .tools { display: none; }
    .dock { flex-direction: column; flex-wrap: nowrap; width: 38px; box-sizing: border-box; align-items: center; }
    .dock :global(button.tile) { width: 34px; height: 34px; }
    .sep { width: auto; height: 1px; align-self: stretch; margin: 3px 2px; }
    .subs { flex-direction: column; flex-wrap: nowrap; }
  }
</style>
