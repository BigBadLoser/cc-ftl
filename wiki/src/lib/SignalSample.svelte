<script lang="ts">
  import CommsWindow from '../../../src/ui/comms/CommsWindow.svelte';
  import PaneHeader from '../../../src/ui/comms/PaneHeader.svelte';
  import VideoFeed from '../../../src/ui/comms/VideoFeed.svelte';
  import CallerCard from '../../../src/ui/comms/CallerCard.svelte';
  import Transcript from '../../../src/ui/comms/Transcript.svelte';
  import SensorPanel from '../../../src/ui/comms/SensorPanel.svelte';
  import DecisionBar from '../../../src/ui/comms/DecisionBar.svelte';
  import type { CallerInfo, CommsLine, DecisionOption } from '../../../src/ui/comms/types';

  // The game's comms pieces (src/ui/comms) composed like its Incoming signal window, before the player has hailed or scanned.
  // The text is a typed sample, not a recorded game (a real signal's portrait and hologram come from the renderer, so those panes show
  // their no-signal states, exactly what the game shows until you hail and scan).
  const none = (): void => {};
  const caller: CallerInfo = { name: 'Unknown skiff', faction: 'Scrapper Clans transponder', status: { label: 'Unknown', tone: 'dim' } };
  const lines: CommsLine[] = [{ kind: 'narration', text: 'A skiff is hailing you off the lane.' }];
  const decisions: DecisionOption[] = [
    { id: 'drop', label: 'Drop out', note: 'Travel pauses here', primary: true }, { id: 'leave', label: 'Fly on', note: 'Continue the trip' },
  ];
</script>

<CommsWindow title="Incoming signal" subtitle="Unknown skiff">
  {#snippet video()}
    <PaneHeader label="Video" action={{ label: 'HAIL', key: 'H', onclick: none }} />
    <div class="col"><VideoFeed /><CallerCard {caller} /></div>
  {/snippet}
  {#snippet comms()}<PaneHeader label="Comms" /><div class="col"><Transcript {lines} hint="Hail to hear more from the caller." /></div>{/snippet}
  {#snippet sensors()}<PaneHeader label="Sensors" action={{ label: 'SCAN', key: 'S', onclick: none }} /><SensorPanel scanned={false} hint="Scan for weapons, boarding craft and crew." />{/snippet}
  {#snippet footer()}<DecisionBar options={decisions} onpick={none} />{/snippet}
</CommsWindow>

<style>
  .col { padding: 12px; display: grid; gap: 12px; align-content: start; }
</style>
