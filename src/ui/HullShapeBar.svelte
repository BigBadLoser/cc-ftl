<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiToolState } from './api';

  /** The Hull shape tool's bar: add or remove, what the preview does, Confirm (disabled while the preview is red) and Cancel. */
  let { api }: { api: UiApi } = $props();
  let st = $state<UiToolState>({ tool: 'build', build: 'shape', moduleDef: null, rot: 0 });
  onMount(() => api.tool.subscribe((t) => (st = t)));
  const remove = $derived(!!st.shape?.remove);
  const phase = $derived(st.shape?.state ?? 'none');
  const set = (r: boolean) => api.setTool({ tool: 'build', build: 'shape', shape: { remove: r } });
</script>

<div class="shapebar" class:red={phase === 'red'} data-testid="hull-shape-bar">
  <b class="t">Hull shape</b>
  <div class="seg" role="group" aria-label="Shape mode">
    <button class:on={!remove} onclick={() => set(false)} data-testid="shape-add">Add</button>
    <button class:on={remove} onclick={() => set(true)} data-testid="shape-remove">Remove</button>
  </div>
  <span class="s" class:bad={phase === 'red'} data-testid="shape-status">
    {#if phase === 'red'}{st.shape?.message || 'Too narrow'}
    {:else if phase === 'ok'}{st.shape?.tiles} tiles to {remove ? 'remove' : 'build'}
    {:else}{st.shape?.message || 'Drag a rectangle, then pull a corner handle inward to chamfer it'}{/if}
  </span>
  <div class="seg">
    <button class="go" disabled={phase !== 'ok'} onclick={() => api.shapeAction('confirm')} data-testid="shape-confirm">Confirm</button>
    <button onclick={() => api.shapeAction('cancel')} data-testid="shape-cancel">Cancel</button>
  </div>
</div>

<style>
  .shapebar { position: fixed; z-index: 5; left: 50%; transform: translateX(-50%); bottom: calc(8px + var(--sab) + 196px); display: flex; align-items: center; flex-wrap: wrap; width: max-content; gap: 12px; padding: 6px 10px; max-width: calc(100vw - 16px); box-sizing: border-box; background: rgba(4, 4, 4, 0.97); border: 1px solid var(--amber); font-size: 13px; color: #c8c8c8; }
  .shapebar.red { border-color: #ff4d4d; }
  .t { color: var(--amber); font: 600 13px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
  .seg { display: flex; gap: 3px; }
  .seg button { min-height: 32px; height: 32px; padding: 0 12px; font: 600 12px var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; }
  .seg button.on, .seg button.go:not(:disabled) { border-color: var(--amber); background: var(--amber); color: #1a1204; }
  .seg button:disabled { opacity: 0.4; }
  .s { white-space: nowrap; }
  .bad { color: #ff9a9a; }
</style>
