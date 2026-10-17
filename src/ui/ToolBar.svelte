<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiBuildKind, UiStock, UiTool, UiToolState } from './api';
  import Cost from './Cost.svelte';

  let { api }: { api: UiApi } = $props();
  let st = $state<UiToolState>({ tool: 'select', build: 'wall', moduleDef: null, rot: 0 });

  let stock = $state<UiStock[]>([]);
  onMount(() => {
    const a = api.tool.subscribe((t) => (st = t));
    const b = api.stock.subscribe((v) => (stock = v));
    return () => (a(), b());
  });
  const have = (item: string) => stock.reduce((n, s) => (s.item === item ? n + s.floor + s.stored : n), 0);
  const short = (k: UiBuildKind) => (api.structCosts[k] ?? []).some((c) => have(c.item) < c.count);

  const tools: { id: UiTool; label: string }[] = [
    { id: 'select', label: 'Select' },
    { id: 'build', label: 'Build' },
    { id: 'deconstruct', label: 'Deconstruct' },
    { id: 'cancel', label: 'Cancel' },
  ];
  const kinds: { id: UiBuildKind; label: string }[] = [
    { id: 'wall', label: 'Wall' },
    { id: 'floor', label: 'Floor' },
    { id: 'door', label: 'Door' },
    { id: 'module', label: 'Modules' },
  ];
</script>

<div class="tools" data-testid="toolbar">
  {#if st.tool === 'build'}
    <div class="col subs">
      {#each kinds as k (k.id)}
        <button class="sub" class:on={st.build === k.id} class:short={k.id !== 'module' && short(k.id)} data-testid="build-{k.id}" onclick={() => api.setTool({ build: k.id })}>
          <span>{k.label}</span>
          {#if k.id !== 'module' && api.structCosts[k.id]}<Cost {api} cost={api.structCosts[k.id] ?? []} {stock} size={14} />{/if}
        </button>
      {/each}
    </div>
  {/if}
  <div class="col">
    {#each tools as t (t.id)}
      <button class:on={st.tool === t.id} data-testid="tool-{t.id}" onclick={() => api.setTool({ tool: t.id })}>{t.label}</button>
    {/each}
  </div>
</div>

<style>
  :global(html[data-combat]) .tools { right: calc(388px + var(--sar)); }
  @media (max-width: 600px) { :global(html[data-combat]) .tools { right: calc(8px + var(--sar)); } }
  .tools { position: fixed; right: calc(8px + var(--sar)); top: calc(var(--hdr) + 48px + var(--sat)); display: flex; gap: 6px; align-items: flex-start; pointer-events: none; }
  .col { display: flex; flex-direction: column; gap: 4px; pointer-events: auto; }
  .subs { margin-top: 44px; }
  button { background: var(--panel); padding: 0 8px; font-size: 13px; min-width: 44px; }
  button.on { background: #0e4a56; }
  .sub { display: grid; justify-items: center; align-content: center; gap: 0; line-height: 1.15; padding: 2px 6px; }
  .sub.short { border-color: #7a3a3a; }
  @media (max-width: 600px) { button { font-size: 12px; padding: 0 6px; } }
</style>
