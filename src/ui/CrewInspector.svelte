<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCrew } from './api';
  import type { UiCrewDetail } from './crewDetailApi';
  import PanelHead from './PanelHead.svelte';
  import TabbedInspector from './inspector/TabbedInspector.svelte';
  import CrewOverview from './crew/CrewOverview.svelte';
  import { crewTabs, type CrewTabProps } from './crew/crewTabs';

  /**
   * The crew inspector: the player's crew get the tabbed inspector (crew/crewTabs.ts); a hostile shows its Overview only.
   * No back tile in the title bar: the tabs go back to the Overview, and Esc or a click on the world closes the inspector.
   */
  let { api, onPriorities }: { api: UiApi; onPriorities: () => void } = $props();
  let crew = $state<UiCrew[]>([]);
  let foes = $state<UiCrew[]>([]);
  let guests = $state<UiCrew[]>([]);
  let sel = $state<number | null>(null);
  let detail = $state<UiCrewDetail | null>(null);
  const c = $derived(crew.find((x) => x.id === sel) ?? guests.find((x) => x.id === sel) ?? foes.find((x) => x.id === sel));
  const enemy = $derived(c?.side === 'enemy');
  /** A passenger (a lodging guest): shown like a crew member's overview, without the tabs that only crew have. */
  const guest = $derived(c?.side === 'guest');
  const tabProps = $derived<CrewTabProps | null>(c ? { api, c, d: detail?.id === c.id ? detail : null, onPriorities } : null);

  onMount(() => {
    const a = api.crew.subscribe((v) => (crew = v));
    const b = api.selectedCrew.subscribe((s) => (sel = s));
    const d = api.hostiles.subscribe((v) => (foes = v));
    const g = api.guests.subscribe((v) => (guests = v));
    const e = api.crewDetail.subscribe((v) => (detail = v));
    return () => (a(), b(), d(), e(), g());
  });
</script>

{#if c && tabProps}
  <div data-testid="crew-inspector">
    {#snippet head()}<PanelHead icon={enemy ? 'skull' : 'person'} title={c.name} sub={guest ? 'Passenger' : c.side === 'visitor' ? `${c.visit ?? 'Visitor'} · ${c.role}` : `${c.role}${enemy ? ' · hostile' : ''}`} foe={enemy} />{/snippet}
    {#if enemy || guest || c.side === 'visitor'}{@render head()}<CrewOverview {...tabProps} />{:else}<TabbedInspector tabs={crewTabs} props={tabProps} {head} />{/if}
  </div>
{/if}
