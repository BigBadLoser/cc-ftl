<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiInspect } from './api';
  import { Chip, Meter, PaneHead, tip } from './kit';
  import InspectorAction from './InspectorAction.svelte';

  /** The player's door inspector: the door's state in words, the two sides it joins with their air, its vent and the jam action. */
  let { api, onBack }: { api: UiApi; onBack: () => void } = $props();
  let info = $state<UiInspect | null>(null);
  onMount(() => api.inspect.subscribe((i) => (info = i)));

  const door = $derived(info?.door ?? null);
  /** 0 = free, 1 = jammed open, 2 = jammed shut (DoorJam). */
  const jam = $derived(info?.fields.find((f) => f.name === 'jam')?.value ?? 0);
  /** The door's vent (VentState): 0 closed, 1 open, 2 set open but held shut by a hazard, 3 set open but held shut for no power. */
  const vent = $derived(info?.fields.find((f) => f.name === 'vent')?.value ?? 0);
  const ventMessage = $derived(
    vent === 0 ? 'Vent closed' : vent === 1 ? 'Vent open: air passes' : vent === 2 ? 'Vent set open, held shut: hazard nearby' : 'Vent set open, held shut: no power',
  );
  const forcing = $derived(info?.job?.kind === 'forceDoor' ? info.job : null);
  const pct = $derived(forcing ? Math.round((forcing.progress / Math.max(1, forcing.work)) * 100) : 0);
  const stateTone = $derived(jam !== 0 ? 'bad' : door?.state === 'Open' ? 'good' : 'dim');

  function forceDoor() {
    if (info) api.dispatch({ type: 'job.forceDoor', ship: info.ship, x: info.x, y: info.y });
  }
  function cancelForce() {
    if (info) api.dispatch({ type: 'job.cancel', ship: info.ship, x: info.x, y: info.y });
  }
  function toggleVent() {
    if (info) api.dispatch({ type: 'door.vent', ship: info.ship, x: info.x, y: info.y, open: vent === 0 });
  }
  const airTip = (s: { o2: number; co2: number; temp: number }): string => `O2 ${s.o2.toFixed(1)} kPa, CO2 ${s.co2.toFixed(2)} kPa, ${s.temp.toFixed(0)} C`;
</script>

{#if info && door}
  <div data-testid="inspector">
    <PaneHead icon="grid" title={door.airlock ? 'Airlock door' : 'Door'} sub="{info.local.x},{info.local.y}" {onBack} />
    <div class="state"><Chip tone={stateTone} size="md" testId="door-state">{door.state}</Chip></div>
    <div class="sides" data-testid="door-sides">
      {#each door.sides as side, i (i)}
        <div class="side" use:tip={{ text: airTip(side) }}>
          <span class="name">{side.label}</span>
          {#if side.label === 'Hull'}
            <Chip>Sealed</Chip>
          {:else if side.label === 'Space'}
            <Chip tone="bad">Vacuum</Chip>
          {:else}
            <Meter value={Math.min(side.o2, 21)} max={21} height={6} tone={side.breathable ? 'good' : 'bad'} />
            <Chip tone={side.hazard ? 'bad' : 'good'}>{side.hazard ? 'Hazard' : 'Breathable'}</Chip>
          {/if}
        </div>
      {/each}
    </div>
    {#if jam !== 0}
      <InspectorAction testid="force-door" alert message="Jammed {jam === 1 ? 'open' : 'shut'}"
        buttons={forcing
          ? [{ label: 'Stop forcing', testid: 'force-cancel', title: 'Cancel forcing the door', onclick: cancelForce }]
          : [{ label: 'Force door', testid: 'force-door-btn', title: 'Force door: crew pry it free', onclick: forceDoor }]}>
        {#if forcing}<Meter value={pct} max={100} height={8} title="Forcing the door: {pct}%" testId="force-progress" />{/if}
      </InspectorAction>
    {/if}
    {#if info.ventable}
      <InspectorAction testid="door-vent" alert={vent >= 2} message={ventMessage}
        buttons={[{ label: vent === 0 ? 'Open vent' : 'Close vent', testid: 'door-vent-btn',
          title: 'A vent lets air pass while the door is shut. It shuts itself on fire, smoke, vacuum, bad air or no power, and reopens when that clears.', onclick: toggleVent }]} />
    {/if}
  </div>
{/if}

<style>
  .state { margin-bottom: 8px; }
  .sides { display: grid; gap: 4px; margin-bottom: 8px; }
  .side { display: grid; grid-template-columns: 1fr 70px auto; align-items: center; gap: 8px; }
  .side .name { color: var(--text); }
</style>
