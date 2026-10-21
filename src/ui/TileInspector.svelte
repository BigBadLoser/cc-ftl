<script lang="ts">
  import { onMount } from 'svelte';
  import { Struct } from '../sim';
  import type { UiApi, UiInspect } from './api';
  import PanelHead from './PanelHead.svelte';
  import ItemIcon from './ItemIcon.svelte';
  import Icon from './Icon.svelte';

  let { api, onBack }: { api: UiApi; onBack: () => void } = $props();
  let info = $state<UiInspect | null>(null);

  onMount(() => api.inspect.subscribe((i) => (info = i)));

  const kinds = [
    { label: 'Make floor', kind: Struct.Floor },
    { label: 'Make wall', kind: Struct.Wall },
    { label: 'Make door', kind: Struct.Door },
    { label: 'Make space', kind: Struct.Space },
  ];

  /** 0 = free, 1 = jammed open, 2 = jammed shut (DoorJam). */
  const jam = $derived(info?.fields.find((f) => f.name === 'jam')?.value ?? 0);
  const jammedDoor = $derived(info?.structName === 'Door' && jam !== 0);
  const forcing = $derived(info?.job?.kind === 'forceDoor' ? info.job : null);
  const pct = $derived(forcing ? Math.round((forcing.progress / Math.max(1, forcing.work)) * 100) : 0);

  function forceDoor() {
    if (info) api.dispatch({ type: 'job.forceDoor', ship: info.ship, x: info.x, y: info.y });
  }
  function cancelForce() {
    if (info) api.dispatch({ type: 'job.cancel', ship: info.ship, x: info.x, y: info.y });
  }
  function setKind(kind: number) {
    if (info?.selected) api.dispatch({ type: 'debug.setStruct', ship: info.ship, x: info.x, y: info.y, kind });
  }
</script>

{#if info}
  <div data-testid="inspector">
    <PanelHead icon="grid" title="Tile {info.local.x}, {info.local.y}" sub="grid {info.grid}" {onBack} />
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
    {#if jammedDoor}
      <div class="force" data-testid="force-door">
        <span class="state"><Icon name="alert" size={16} />Jammed {jam === 1 ? 'open' : 'shut'}</span>
        {#if forcing}
          <div class="bar" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" title="Forcing the door: {pct}%" data-testid="force-progress"><i style="width:{pct}%"></i></div>
          <button class="tile" title="Cancel forcing the door" aria-label="Cancel forcing the door" data-testid="force-cancel" onclick={cancelForce}><Icon name="close" size={18} /></button>
        {:else}
          <button class="tile act" title="Force door: crew pry it free" aria-label="Force door" data-testid="force-door-btn" onclick={forceDoor}><Icon name="door" size={20} /></button>
          <span class="lbl">Force door</span>
        {/if}
      </div>
    {/if}
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
  .force { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; padding: 6px 8px; background: var(--panel-2); border: 1px solid var(--amber); }
  .state { display: inline-flex; align-items: center; gap: 4px; color: var(--amber); flex: 1; }
  .lbl { color: var(--text); font: 600 12px var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; }
  .bar { flex: 1; height: 8px; background: var(--panel); border: 1px solid var(--line); }
  .bar i { display: block; height: 100%; background: var(--amber); }
  .dbg { color: var(--dim); font: 600 12px var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 4px; }
  .btns { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  @media (max-width: 600px) {
    .btns { grid-template-columns: repeat(4, 1fr); }
    .btns button { padding: 0 4px; font-size: 12px; }
  }
</style>
