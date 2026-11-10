<script lang="ts">
  import { onMount } from 'svelte';
  import { Tabs } from './kit';
  import type { UiApi, UiCrew } from './api';
  import FloatingWindow from './FloatingWindow.svelte';
  import { centerTop } from './floatingWindow';
  import PriorityTable from './PriorityTable.svelte';
  import SchedulePane from './SchedulePane.svelte';

  /** The Crew window: priorities per crew member, and their day plan (#412). */
  let { api, onClose }: { api: UiApi; onClose: () => void } = $props();
  let crew = $state<UiCrew[]>([]);
  onMount(() => api.crew.subscribe((v) => (crew = v)));

  const KEY = 'cc-ftl.crewTab';
  function load(): 'priorities' | 'schedule' {
    try { return localStorage.getItem(KEY) === 'schedule' ? 'schedule' : 'priorities'; } catch { return 'priorities'; }
  }
  let tab = $state<'priorities' | 'schedule'>(load());
  function pick(v: string) {
    tab = v === 'schedule' ? 'schedule' : 'priorities';
    try { localStorage.setItem(KEY, tab); } catch { /* storage blocked: the tab just isn't remembered */ }
  }
</script>

<FloatingWindow id="priorities" title="Crew" icon="person" min={{ w: 360, h: 200 }} defaultRect={(b) => ({ ...centerTop(b, tab === 'schedule' ? 700 : 640), anchor: 'bottom' })} {onClose} testId="priority-grid" closeTestId="priority-close" padded>
  <Tabs options={[{ value: 'priorities', label: 'Priorities', testId: 'crew-tab-priorities' }, { value: 'schedule', label: 'Schedule', testId: 'crew-tab-schedule' }]} value={tab} onChange={pick} label="Crew sections" />
  <div class="page">
    {#if tab === 'schedule'}<SchedulePane {api} {crew} />{:else}<PriorityTable {api} {crew} />{/if}
  </div>
</FloatingWindow>

<style>
  .page { margin-top: 10px; }
</style>
