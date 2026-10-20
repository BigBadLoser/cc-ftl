<script lang="ts">
  import { onMount } from 'svelte';
  import { Struct } from '../sim';
  import type { UiApi, UiInspect } from './api';
  import PanelHead from './PanelHead.svelte';
  import ItemIcon from './ItemIcon.svelte';

  let { api, onBack }: { api: UiApi; onBack: () => void } = $props();
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
  <div data-testid="inspector">
    <PanelHead icon="grid" title="Tile {info.x}, {info.y}" sub="grid {info.gridId}" {onBack} />
    <dl>
      <dt>Struct</dt><dd data-testid="inspect-struct">{info.structName}</dd>
      <dt>Room</dt><dd data-testid="inspect-room">{info.room || 'none'}</dd>
      {#if info.stack}
        <dt>Floor stack</dt>
        <dd class="stack" data-testid="inspect-stack"><ItemIcon {api} item={info.stack.item} size={26} />{info.stack.count} {info.stack.name}</dd>
      {/if}
      {#each info.fields.filter((f) => f.name !== 'struct' && f.name !== 'room' && f.name !== 'item') as f (f.name)}
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
  </div>
{/if}

<style>
  dl { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; margin: 0 0 8px; font-variant-numeric: tabular-nums; }
  dt { color: var(--dim); } dd { margin: 0; text-align: right; }
  dd.stack { display: flex; align-items: center; justify-content: flex-end; gap: 4px; color: var(--text); }
  .dbg { color: var(--dim); font: 600 12px var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 4px; }
  .btns { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  @media (max-width: 600px) {
    .btns { grid-template-columns: repeat(4, 1fr); }
    .btns button { padding: 0 4px; font-size: 12px; }
  }
</style>
