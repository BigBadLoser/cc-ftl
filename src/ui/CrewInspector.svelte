<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCrew } from './api';
  import type { UiCrewDetail } from './crewDetailApi';
  import PanelHead from './PanelHead.svelte';
  import TabbedInspector from './inspector/TabbedInspector.svelte';
  import CrewOverview from './crew/CrewOverview.svelte';
  import { crewTabs, type CrewTabProps } from './crew/crewTabs';

  /** The crew inspector: the player's crew get the tabbed inspector (crew/crewTabs.ts); a hostile shows its Overview only. */
  let { api, onPriorities, onBack }: { api: UiApi; onPriorities: () => void; onBack: () => void } = $props();
  let crew = $state<UiCrew[]>([]);
  let foes = $state<UiCrew[]>([]);
  let sel = $state<number | null>(null);
  let detail = $state<UiCrewDetail | null>(null);
  const c = $derived(crew.find((x) => x.id === sel) ?? foes.find((x) => x.id === sel));
  const enemy = $derived(c?.side === 'enemy');
  const tabProps = $derived<CrewTabProps | null>(c ? { api, c, d: detail?.id === c.id ? detail : null, onPriorities } : null);

  onMount(() => {
    const a = api.crew.subscribe((v) => (crew = v));
    const b = api.selectedCrew.subscribe((s) => (sel = s));
    const d = api.hostiles.subscribe((v) => (foes = v));
    const e = api.crewDetail.subscribe((v) => (detail = v));
    return () => (a(), b(), d(), e());
  });
</script>

{#if c && tabProps}
  <div data-testid="crew-inspector">
    <PanelHead icon={enemy ? 'skull' : 'person'} title={c.name} sub="{c.role}{enemy ? ' · hostile' : ''}" foe={enemy} {onBack} />
    {#if enemy}<CrewOverview {...tabProps} />{:else}<TabbedInspector tabs={crewTabs} props={tabProps} title={c.name} />{/if}
  </div>
{/if}
