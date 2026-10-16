<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiToolState } from './api';

  let { api }: { api: UiApi } = $props();
  let st = $state<UiToolState>({ tool: 'select', build: 'wall', moduleDef: null, rot: 0 });
  onMount(() => api.tool.subscribe((t) => (st = t)));
  const power = (p: number) => (p > 0 ? `+${p}⚡` : p < 0 ? `${p}⚡` : '');
</script>

<aside class="sheet" data-testid="build-modules">
  <div class="top">
    <h2>Modules</h2>
    <button data-testid="rotate" onclick={() => api.setTool({ rot: (st.rot + 1) % 4 })}>Rotate (R) {st.rot * 90}°</button>
  </div>
  <div class="list">
    {#each api.moduleDefs as d (d.id)}
      <button class="item" class:on={st.moduleDef === d.id} data-testid="mod-{d.id}" onclick={() => api.setTool({ moduleDef: d.id })} title={d.cost}>
        <span class="n">{d.name}</span>
        <span class="m">{d.w}×{d.h} <b>{power(d.power)}</b></span>
      </button>
    {/each}
  </div>
  <p class="hint">{st.moduleDef ? 'Drag or move to position, release or click to place.' : 'Pick a module.'}</p>
</aside>

<style>
  aside { left: calc(8px + var(--sal)); bottom: calc(8px + var(--sab)); width: 280px; }
  .top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; gap: 8px; }
  h2 { margin: 0; font-size: 15px; color: var(--cyan); }
  .top button { font-size: 12px; min-height: 34px; }
  .list { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .item { display: grid; text-align: left; padding: 4px 8px; line-height: 1.25; }
  .m { font-size: 12px; color: var(--dim); }
  .m b { color: var(--cyan); font-weight: 600; margin-left: 4px; }
  .hint { margin: 6px 0 0; color: var(--dim); font-size: 12px; }
  @media (max-width: 600px) { aside { width: auto; left: 0; bottom: 0; } .list { grid-template-columns: repeat(3, 1fr); } }
</style>
