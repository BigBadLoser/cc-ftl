<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiBuildKind, UiTool, UiToolState } from './api';

  let { api }: { api: UiApi } = $props();
  let st = $state<UiToolState>({ tool: 'select', build: 'wall' });

  onMount(() => api.tool.subscribe((t) => (st = t)));

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
  ];
</script>

<div class="tools" data-testid="toolbar">
  {#if st.tool === 'build'}
    <div class="col subs">
      {#each kinds as k (k.id)}
        <button class:on={st.build === k.id} data-testid="build-{k.id}" onclick={() => api.setTool({ build: k.id })}>{k.label}</button>
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
  .tools { position: fixed; right: calc(8px + var(--sar)); top: calc(104px + var(--sat)); display: flex; gap: 6px; align-items: flex-start; pointer-events: none; }
  .col { display: flex; flex-direction: column; gap: 4px; pointer-events: auto; }
  .subs { margin-top: 44px; }
  button { background: var(--panel); padding: 0 8px; font-size: 13px; min-width: 44px; }
  button.on { background: #0e4a56; }
  @media (max-width: 600px) { button { font-size: 12px; padding: 0 6px; } }
</style>
