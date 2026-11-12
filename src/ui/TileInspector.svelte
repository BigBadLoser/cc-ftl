<script lang="ts">
  import { Meter } from './kit';
  import { onMount } from 'svelte';
  import { Struct } from '../sim';
  import type { UiApi, UiInspect } from './api';
  import { PaneHead } from './kit';
  import ItemIcon from './ItemIcon.svelte';
  import InspectorAction from './InspectorAction.svelte';

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
  /** The door's vent (VentState): 0 closed, 1 open, 2 set open but held shut by a hazard, 3 set open but held shut for no power. */
  const vent = $derived(info?.fields.find((f) => f.name === 'vent')?.value ?? 0);
  const ventDoor = $derived(info?.structName === 'Door' && info.fields.some((f) => f.name === 'vent'));
  const ventMessage = $derived(
    vent === 0 ? 'Vent closed' : vent === 1 ? 'Vent open: air passes' : vent === 2 ? 'Vent set open, held shut: hazard nearby' : 'Vent set open, held shut: no power',
  );
  const forcing = $derived(info?.job?.kind === 'forceDoor' ? info.job : null);
  const pct = $derived(forcing ? Math.round((forcing.progress / Math.max(1, forcing.work)) * 100) : 0);

  function forceDoor() {
    if (info) api.dispatch({ type: 'job.forceDoor', ship: info.ship, x: info.x, y: info.y });
  }
  function toggleVent() {
    if (info) api.dispatch({ type: 'door.vent', ship: info.ship, x: info.x, y: info.y, open: vent === 0 });
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
    <PaneHead icon="grid" title="Tile {info.local.x}, {info.local.y}" sub="grid {info.grid}" {onBack} />
    <dl>
      <dt>Struct</dt><dd data-testid="inspect-struct">{info.structName}</dd>
      <dt>Room</dt><dd data-testid="inspect-room">{info.room || 'none'}</dd>
      {#if info.stack}
        <dt>Floor stack</dt>
        <dd class="stack" data-testid="inspect-stack"><ItemIcon {api} item={info.stack.item} size={26} />{info.stack.count} {info.stack.name}</dd>
      {/if}
      {#each info.fields.filter((f) => f.name !== 'struct' && f.name !== 'room' && f.name !== 'item' && f.name !== 'vent') as f (f.name)}
        <dt>{f.name}</dt><dd>{Number.isInteger(f.value) ? f.value : f.value.toFixed(2)}</dd>
      {/each}
    </dl>
    {#if info.stack?.crate}
      {@const crate = info.stack.crate}
      <InspectorAction testid="inspect-crate" resetKey={crate.job} message="Sealed delivery: {crate.title}, to {crate.to}."
        buttons={[{ label: 'Break open', testid: 'crate-open', onclick: () => api.dispatch({ type: 'jobs.openCrate', id: crate.job }),
          confirm: { warning: 'The delivery fails: you keep the goods, but lose standing with the issuer and gain notoriety.', label: 'Break it open', cancel: 'Keep it sealed' } }]} />
    {/if}
    {#if jammedDoor}
      <InspectorAction testid="force-door" alert message="Jammed {jam === 1 ? 'open' : 'shut'}"
        buttons={forcing
          ? [{ label: 'Stop forcing', testid: 'force-cancel', title: 'Cancel forcing the door', onclick: cancelForce }]
          : [{ label: 'Force door', testid: 'force-door-btn', title: 'Force door: crew pry it free', onclick: forceDoor }]}>
        {#if forcing}<Meter value={pct} max={100} height={8} title="Forcing the door: {pct}%" testId="force-progress" />{/if}
      </InspectorAction>
    {/if}
    {#if ventDoor}
      <InspectorAction testid="door-vent" alert={vent >= 2} message={ventMessage}
        buttons={[{ label: vent === 0 ? 'Open vent' : 'Close vent', testid: 'door-vent-btn',
          title: 'A vent lets air pass while the door is shut. It shuts itself on fire, smoke, vacuum, bad air or no power, and reopens when that clears.', onclick: toggleVent }]} />
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
  .dbg { color: var(--dim); font: 600 12px var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 4px; }
  .btns { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  @media (max-width: 600px) {
    .btns { grid-template-columns: repeat(4, 1fr); }
    .btns button { padding: 0 4px; font-size: 12px; }
  }
</style>
