<script lang="ts">
  import { Tabs } from '../../../src/ui/kit';
  import JobsBoard from '../../../src/ui/JobsBoard.svelte';
  import { apiOf } from './panels';
  import type { Panels } from './panels';

  // The game's jobs board at three kinds of station, one tab each (the tab look is the game's own Tabs). Each board is a recorded game:
  // the station's offers, the first one already taken. The tabs are the wiki's own; the game shows one board for wherever you are.
  let { boards }: { boards: { trade: Panels['jobsBoard']; military: Panels['jobsMilitary']; research: Panels['jobsResearch'] } } = $props();
  const options = [
    { value: 'trade', label: 'Trade station' },
    { value: 'military', label: 'Military station' },
    { value: 'research', label: 'Research station' },
  ];
  let tab = $state<keyof typeof boards>('trade');
</script>

<Tabs {options} value={tab} onChange={(v) => (tab = v as keyof typeof boards)} label="Station types" />
<div class="board">
  {#key tab}<JobsBoard api={apiOf(boards[tab])} />{/key}
</div>

<style>
  .board { margin-top: 6px; }
</style>
