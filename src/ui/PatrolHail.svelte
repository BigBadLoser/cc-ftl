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
   * A patrol's hail to stop (#138 step 2): the comms pieces (src/ui/comms) composed for it. The trip is halted in hyperspace until the player
   * complies (drop out and be boarded) or runs. The captain is on video at once (they called you), the patrol ship is on the sensors.
   */
  let { api, encounter }: { api: UiApi; encounter: UiEncounter } = $props();
  const h = $derived(encounter.hail!);
  let busy = $state(false);
  $effect(() => { void encounter.id; busy = false; });

  let face = $state<string | null>(null);
  $effect(() => {
    const look = h.look;
    face = null;
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
    let live = true;
    const t = setTimeout(() => void api.shipHolo(req).then((x) => { if (live) { holo = x; holoDone = true; } }), 250);
    return () => { live = false; clearTimeout(t); };
  });

  const decisions = $derived<DecisionOption[]>(encounter.choices.map((c, i) => ({
    id: c.choice, label: c.label, primary: i === 0, disabled: !c.enabled, note: c.why ?? c.detail, ...(c.why ? { reason: c.why } : {}),
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
    <VideoFeed src={face} />
    <CallerCard caller={h.caller} />
  </div>
{/snippet}
{#snippet commsCol()}
  <PaneHeader label="Comms" />
  <div class="col scroll"><Transcript lines={h.transcript} /></div>
{/snippet}
{#snippet sensorsCol()}
  <PaneHeader label="Sensors" done="SCANNED" />
  <SensorPanel scanned {holo} pending={!holoDone} title={h.hullTitle} callouts={[]} readout={h.readout} />
{/snippet}
{#snippet decisionBar()}
  <DecisionBar options={decisions} onpick={pick} {busy} />
{/snippet}

<Dialog open title={encounter.title} dismissable={false} testId="patrol-hail" bare>
  <CommsWindow title="Incoming hail" subtitle={`${encounter.faction} patrol · ${encounter.node}`} video={videoCol} comms={commsCol} sensors={sensorsCol} footer={decisionBar} />
</Dialog>

<style>
  .col { padding: 12px; display: grid; gap: 12px; align-content: start; }
  .scroll { max-height: 420px; overflow-y: auto; }
</style>
