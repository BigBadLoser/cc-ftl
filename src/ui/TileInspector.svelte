<script lang="ts">
  import { onMount } from 'svelte';
  import { Struct } from '../sim';
  import type { UiApi, UiInspect } from './api';

  let { api }: { api: UiApi } = $props();
  let info = $state<UiInspect | null>(null);

  onMount(() => api.inspect.subscribe((i) => (info = i)));

  const kinds = [
    { label: 'Make floor', kind: Struct.Floor },
    { label: 'Make wall', kind: Struct.Wall },
    { label: 'Make door', kind: Struct.Door },
    { label: 'Make space', kind: Struct.Space },
  ];

  function setKind(kind: number) {
    if (info?.selected) api.dispatch({ type: 'debug.setStruct', gridId: info.gridId, x: info.x, y: info.y, kind });
  }
</script>

{#if info}
  <aside data-testid="inspector">
    <h2>Tile {info.x}, {info.y} <small>grid {info.gridId}{info.selected ? '' : ' (hover)'}</small></h2>
    <dl>
      <dt>Struct</dt><dd data-testid="inspect-struct">{info.structName}</dd>
      <dt>Room</dt><dd data-testid="inspect-room">{info.room || 'none'}</dd>
      {#each info.fields.filter((f) => f.name !== 'struct' && f.name !== 'room') as f (f.name)}
        <dt>{f.name}</dt><dd>{Number.isInteger(f.value) ? f.value : f.value.toFixed(2)}</dd>
      {/each}
    </dl>
    {#if info.selected}
      <div class="dbg">Debug: instant</div>
      <div class="btns">
        {#each kinds as k (k.kind)}
          <button onclick={() => setKind(k.kind)}>{k.label}</button>
        {/each}
      </div>
    {/if}
  </aside>
{/if}

<style>
  aside {
    position: fixed; left: calc(8px + var(--sal)); bottom: calc(8px + var(--sab));
    width: 240px; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px;
    pointer-events: auto;
  }
  h2 { margin: 0 0 6px; font-size: 14px; color: var(--cyan); }
  h2 small { color: var(--dim); font-weight: normal; margin-left: 6px; }
  dl { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; margin: 0 0 8px; font-variant-numeric: tabular-nums; }
  dt { color: var(--dim); } dd { margin: 0; text-align: right; }
  .dbg { color: var(--dim); font-size: 12px; margin-bottom: 4px; }
  .btns { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  @media (max-width: 600px) {
    aside { left: 0; right: 0; bottom: 0; width: auto; border-radius: 14px 14px 0 0; border-width: 1px 0 0; padding: 10px 14px calc(10px + var(--sab)); }
    .btns { grid-template-columns: repeat(4, 1fr); }
    .btns button { padding: 0 4px; font-size: 12px; }
  }
</style>
