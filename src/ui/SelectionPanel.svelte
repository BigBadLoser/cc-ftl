<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCrew, UiInspect, UiModule, UiShuttles, UiSite } from './api';
  import FloatingWindow from './FloatingWindow.svelte';
  import { isPinned } from './floatingWindow';
  import GridPanel from './GridPanel.svelte';
  import AsteroidPanel from './AsteroidPanel.svelte';
  import CrewInspector from './CrewInspector.svelte';
  import ModuleInspector from './ModuleInspector.svelte';
  import SiteInspector from './SiteInspector.svelte';
  import ShuttlePanel from './ShuttlePanel.svelte';
  import TileInspector from './TileInspector.svelte';

  let { api, onPriorities, onTrade, onStation, onResearch }: { api: UiApi; onPriorities: () => void; onTrade: (ship: number) => void; onStation: (ship: number) => void; onResearch: () => void } = $props();
  let crew = $state<UiCrew[]>([]);
  let foes = $state<UiCrew[]>([]);
  let mods = $state<UiModule[]>([]);
  let bays = $state<UiShuttles['bays']>([]);
  let info = $state<UiInspect | null>(null);
  let selCrew = $state<number | null>(null);
  let selMod = $state<number | null>(null);
  let selShip = $state<number | null>(null);
  let selAst = $state<number | null>(null);
  let sites = $state<UiSite[]>([]);
  let selSite = $state<number | null>(null);

  onMount(() => {
    const u = [
      api.crew.subscribe((v) => (crew = v)),
      api.hostiles.subscribe((v) => (foes = v)),
      api.modules.subscribe((v) => (mods = v)),
      api.shuttles.subscribe((v) => (bays = v.bays)),
      api.inspect.subscribe((v) => (info = v)),
      api.selectedCrew.subscribe((v) => (selCrew = v)),
      api.selectedModule.subscribe((v) => (selMod = v)),
      api.selectedShip.subscribe((v) => (selShip = v)),
      api.selectedAsteroid.subscribe((v) => (selAst = v)),
      api.sites.subscribe((v) => (sites = v)),
      api.selectedSite.subscribe((v) => (selSite = v)),
    ];
    return () => u.forEach((f) => f());
  });

  /** Clearing any selection hides the inspector. */
  const back = () => api.selectCrew(null);
  const hasCrew = $derived(selCrew !== null && (crew.some((c) => c.id === selCrew) || foes.some((c) => c.id === selCrew)));
  const mod = $derived(selMod === null ? undefined : mods.find((m) => m.id === selMod));
  const site = $derived(selSite !== null && sites.some((x) => x.id === selSite));
  const tile = $derived(info?.selected ? info : null);
  const wide = $derived(!hasCrew && !!mod && (mod.crafting || !!mod.storage));
  /** The inspector exists only while something is selected; ship stats live behind the ship tab. */
  /** A pinned inspector stays up (empty) when the selection clears. */
  let pinned = $state(isPinned('inspector'));
  const shown = $derived(selAst !== null || selShip !== null || hasCrew || !!mod || site || !!tile);
</script>

{#if shown || pinned}
<FloatingWindow id="inspector" title="Inspector" min={{ w: 260, h: 140 }} defaultRect={(b) => ({ x: b.left, y: 0, w: wide ? 340 : 300, h: 0, anchor: 'bottom' })} onClose={back} testId="selection-panel" bare pinRight={0} padded bind:pinned>
  {#if selAst !== null}
    <AsteroidPanel {api} asteroid={selAst} onBack={back} />
  {:else if selShip !== null}
    <GridPanel {api} ship={selShip} onBack={back} {onTrade} {onStation} />
  {:else if hasCrew}
    <CrewInspector {api} {onPriorities} onBack={back} />
  {:else if site}
    <SiteInspector {api} onBack={back} />
  {:else if mod && bays.some((b) => b.id === mod.id)}
    <ShuttlePanel {api} onBack={back} />
  {:else if mod}
    <ModuleInspector {api} onBack={back} {onResearch} />
  {:else if tile}
    <TileInspector {api} onBack={back} />
  {:else}
    <div class="ph">Inspector</div>
    <p class="empty">Nothing selected. Pick a crew member, module, tile or ship.</p>
  {/if}
</FloatingWindow>
{/if}

<style>
  .empty { margin: 0; color: var(--dim); font-size: 13px; }
</style>
