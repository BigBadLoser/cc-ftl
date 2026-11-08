<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi } from './api';
  import { Dialog } from './kit';
  import CommsWindow from './comms/CommsWindow.svelte';
  import PaneHeader from './comms/PaneHeader.svelte';
  import VideoFeed from './comms/VideoFeed.svelte';
  import CallerCard from './comms/CallerCard.svelte';
  import Transcript from './comms/Transcript.svelte';
  import SensorPanel from './comms/SensorPanel.svelte';
  import DecisionBar from './comms/DecisionBar.svelte';
  import type { DecisionOption, UiHolo } from './comms/types';
  import type { UiEncounter, UiEncounterChoice } from './starmapApi';
  import { holdModal } from './keys';

  /**
   * A hail to stop mid-jump: the comms pieces (src/ui/comms) composed for it. A patrol's (#138 step 2): the trip is halted in hyperspace until the player
   * complies (drop out and be boarded) or runs. An interdiction's (#363): pirates, a route guard or hunters, answered by evade, bribe or fight. The
   * captain is on video at once (they called you), their ship is on the sensors.
   */
  let { api, encounter }: { api: UiApi; encounter: UiEncounter } = $props();
  const h = $derived(encounter.hail!);
  let busy = $state(false);
  $effect(() => { void encounter.id; busy = false; });

  let face = $state<string | null>(null);
  $effect(() => {
    const look = h.look;
    face = null;
    if (!look) return;
    const t = setInterval(() => {
      const f = api.lookPortrait(look);
      if (f) { face = f; clearInterval(t); }
    }, 120);
    return () => clearInterval(t);
  });

  let holo = $state<UiHolo | null>(null);
  let holoDone = $state(false);
  $effect(() => {
    const req = h.holo;
    holo = null;
    holoDone = false;
    if (!req) return;
    let live = true;
    const t = setTimeout(() => void api.shipHolo(req).then((x) => { if (live) { holo = x; holoDone = true; } }), 250);
    return () => { live = false; clearTimeout(t); };
  });

  const decisions = $derived<DecisionOption[]>(encounter.choices.map((c, i) => ({
    id: c.choice, label: c.label, primary: i === 0 && !h.hostile, disabled: !c.enabled, note: c.why ?? c.detail, ...(c.why ? { reason: c.why } : {}),
  })));

  function pick(id: string) {
    if (busy) return;
    busy = true;
    api.dispatch({ type: 'galaxy.respond', encounter: encounter.id, choice: id as UiEncounterChoice['choice'] });
  }
  onMount(() => holdModal());
</script>

{#snippet videoCol()}
  <PaneHeader label="Video" done="CONNECTED" />
  <div class="col">
    <VideoFeed src={face} label={h.look ? 'NO VIDEO' : 'NO FACE'} />
    <CallerCard caller={h.caller} />
  </div>
{/snippet}
{#snippet commsCol()}
  <PaneHeader label="Comms" />
  <div class="col scroll"><Transcript lines={h.transcript} /></div>
{/snippet}
{#snippet sensorsCol()}
  <PaneHeader label="Sensors" done="SCANNED" />
  <SensorPanel scanned={!!h.holo} {holo} pending={!holoDone} title={h.hullTitle} callouts={[]} readout={h.readout} />
{/snippet}
{#snippet decisionBar()}
  <DecisionBar options={decisions} onpick={pick} {busy} />
{/snippet}

<Dialog open title={encounter.title} dismissable={false} testId={encounter.kind === 'interdict' ? 'interdict-hail' : 'patrol-hail'} bare>
  <div class="frame" class:hostile={h.hostile}>
  <CommsWindow title={h.title ?? 'Incoming hail'} subtitle={h.subtitle ?? `${encounter.faction} patrol · ${encounter.node}`} video={videoCol} comms={commsCol} sensors={sensorsCol} footer={decisionBar} />
  </div>
</Dialog>

<style>
  .col { padding: 12px; display: grid; gap: 12px; align-content: start; }
  .scroll { max-height: 420px; overflow-y: auto; }
  .frame.hostile :global(.win) { border-color: var(--red); }
  .frame.hostile :global(.win > .title b) { color: var(--red); }
</style>
