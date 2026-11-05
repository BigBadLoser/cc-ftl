<script lang="ts">
  import CommsWindow from '../../src/ui/comms/CommsWindow.svelte';
  import PaneHeader from '../../src/ui/comms/PaneHeader.svelte';
  import VideoFeed from '../../src/ui/comms/VideoFeed.svelte';
  import CallerCard from '../../src/ui/comms/CallerCard.svelte';
  import Transcript from '../../src/ui/comms/Transcript.svelte';
  import SensorPanel from '../../src/ui/comms/SensorPanel.svelte';
  import StaticFeed from '../../src/ui/comms/StaticFeed.svelte';
  import FlickerText from '../../src/ui/comms/FlickerText.svelte';
  import DecisionBar from '../../src/ui/comms/DecisionBar.svelte';
  import type { UiHolo, CallerInfo, CommsLine, DecisionOption, ReadoutRow } from '../../src/ui/comms/types';

  let { face, holo }: { face: string | null; holo: UiHolo | null } = $props();
  const noop = (): void => {};
  const before: CallerInfo = { name: 'Unknown skiff', faction: 'Scrapper Clans transponder', status: { label: 'Unknown', tone: 'dim' } };
  const after: CallerInfo = { name: 'Tam', alt: 'Ren', role: 'Captain of the', ship: 'raider SC-4471', faction: 'Scrapper Clans · raider skiff', swatch: '#c96b3a', status: { label: 'Neutral', tone: 'amber' } };
  const lines: CommsLine[] = [
    { kind: 'narration', text: 'A skiff you know hails you off the lane.' },
    { kind: 'speech', speaker: 'Skiff', text: "You let me go back there. I haven't forgotten. I owe you, and I mean to pay." },
    { kind: 'speech', speaker: 'Tam', speakerAlt: 'Ren', text: "Captain, it's Tam, the one you spared. I owe you my life." },
  ];
  const callouts = $derived(holo ? [
    { id: 'weapons', label: 'Weapons', value: 'Guns hot', at: holo.anchors['weapons'] ?? { x: 0.7, y: 0.3 } },
    { id: 'boarding', label: 'Boarding craft', value: 'Shuttle fuelled, suited crew', at: holo.anchors['boarding'] ?? { x: 0.3, y: 0.7 } },
  ] : []);
  const readout: ReadoutRow[] = [
    { label: 'Transponder', value: 'Scrapper Clans · SC-4471', alt: 'Scrapper Clans · SC-0912', wide: true },
    { label: 'Hull', value: 'Raider class' }, { label: 'Crew aboard', value: '4' },
  ];
  const decisions: DecisionOption[] = [
    { id: 'a', label: 'Drop out', note: 'Travel pauses here', primary: true }, { id: 'b', label: 'Fly on', note: 'Continue the trip' },
  ];
</script>

<div class="lab">
  <h3>StaticFeed (grey, cyan, tagged) <small>56x56 noise, dim, scanlines</small></h3>
  <div class="row">
    <div class="box" style="width:194px;height:194px"><StaticFeed label="NO VIDEO" still /></div>
    <div class="box" style="width:314px;height:210px"><StaticFeed tone="cyan" label="NO SCAN" tag="CONTACT" still /></div>
    <div class="box" style="width:314px;height:210px"><StaticFeed tone="cyan" label="RESOLVING" tag="RAIDER CLASS" still /></div>
  </div>
  <h3>VideoFeed <small>no signal / live / stutter held</small></h3>
  <div class="row">
    <div style="width:194px"><VideoFeed /></div>
    <div style="width:194px"><VideoFeed src={face} /></div>
    <div style="width:194px"><VideoFeed src={face} stutter force /></div>
  </div>
  <h3>FlickerText <small>rest / alt held</small></h3>
  <div class="row big"><FlickerText value="Tam" alt="Ren" /> <FlickerText value="Tam" alt="Ren" force /> <FlickerText value="SC-4471" alt="SC-0912" force /> <FlickerText value="never" /></div>
  <h3>CallerCard <small>before hail / after / name flicker held</small></h3>
  <div class="row"><div class="box w"><CallerCard caller={before} /></div><div class="box w"><CallerCard caller={after} /></div><div class="box w"><CallerCard caller={after} force /></div></div>
  <h3>PaneHeader <small>action / done / plain</small></h3>
  <div class="row"><div class="box w0"><PaneHeader label="Video" action={{ label: 'HAIL', key: 'H', onclick: noop }} /></div><div class="box w0"><PaneHeader label="Video" done="CONNECTED" /></div><div class="box w0"><PaneHeader label="Comms" /></div></div>
  <h3>Transcript <small>before hail (with hint) / after / speaker flicker held</small></h3>
  <div class="row"><div class="box w2"><Transcript lines={lines.slice(0, 2)} hint="Hail to hear more from the caller." /></div><div class="box w2"><Transcript lines={lines} /></div><div class="box w2"><Transcript lines={lines} force /></div></div>
  <h3>SensorPanel <small>no scan / resolving / scanned / readout flicker held</small></h3>
  <div class="row top">
    <div class="box w3"><SensorPanel scanned={false} hint="Scan for weapons, boarding craft and crew." /></div>
    <div class="box w3"><SensorPanel scanned pending title="RAIDER CLASS" /></div>
    <div class="box w3"><SensorPanel scanned {holo} title="RAIDER CLASS" {callouts} {readout} /></div>
    <div class="box w3"><SensorPanel scanned {holo} title="RAIDER CLASS" {callouts} {readout} force /></div>
  </div>
  <h3>DecisionBar</h3>
  <div class="box wide"><DecisionBar options={decisions} onpick={noop} /></div>
  <h3>CommsWindow composed (the signal window, hailed and scanned, with the flicker held)</h3>
  <CommsWindow title="Incoming signal" subtitle="The pirate you spared">
    {#snippet video()}
      <PaneHeader label="Video" done="CONNECTED" />
      <div class="col"><VideoFeed src={face} /><CallerCard caller={after} force /></div>
    {/snippet}
    {#snippet comms()}<PaneHeader label="Comms" /><div class="col"><Transcript lines={lines} force /></div>{/snippet}
    {#snippet sensors()}<PaneHeader label="Sensors" done="SCANNED" /><SensorPanel scanned {holo} title="RAIDER CLASS" {callouts} {readout} force />{/snippet}
    {#snippet footer()}<DecisionBar options={decisions} onpick={noop} />{/snippet}
  </CommsWindow>
</div>

<style>
  .lab { padding: 12px 16px 40px; color: var(--text); font-family: system-ui, sans-serif; font-size: 14px; background: #0a0d12; }
  h3 { margin: 18px 0 8px; font: 600 12px var(--head-font); letter-spacing: 0.12em; text-transform: uppercase; color: var(--cyan); }
  h3 small { color: var(--dim); text-transform: none; letter-spacing: 0; font: 12px system-ui; margin-left: 8px; }
  .row { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
  .row.big { font: 700 18px var(--head-font); gap: 28px; }
  .box { background: var(--panel-2); border: 1px solid var(--line); box-sizing: border-box; padding: 0; }
  .box.w { width: 220px; padding: 12px; }
  .box.w0 { width: 220px; }
  .box.w2 { width: 420px; padding: 12px; }
  .box.w3 { width: 340px; }
  .box.wide { width: 1080px; }
  .col { padding: 12px; display: grid; gap: 12px; align-content: start; }
</style>
