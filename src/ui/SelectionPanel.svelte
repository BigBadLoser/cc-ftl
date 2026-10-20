<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCombat, UiCrew, UiInspect, UiModule, UiShuttles, UiStats } from './api';
  import CrewInspector from './CrewInspector.svelte';
  import Icon from './Icon.svelte';
  import ModuleInspector from './ModuleInspector.svelte';
  import PanelHead from './PanelHead.svelte';
  import ShuttlePanel from './ShuttlePanel.svelte';
  import ShipMeters from './ShipMeters.svelte';
  import TileInspector from './TileInspector.svelte';

  let { api, onPriorities }: { api: UiApi; onPriorities: () => void } = $props();
  let crew = $state<UiCrew[]>([]);
  let foes = $state<UiCrew[]>([]);
  let mods = $state<UiModule[]>([]);
  let stats = $state<UiStats>({ supply: 0, demand: 0, o2: null });
  let combat = $state<UiCombat>({ inCombat: false, player: null, enemies: [] });
  let bays = $state<UiShuttles['bays']>([]);
  let info = $state<UiInspect | null>(null);
  let selCrew = $state<number | null>(null);
  let selMod = $state<number | null>(null);

  onMount(() => {
    const u = [
      api.crew.subscribe((v) => (crew = v)),
      api.hostiles.subscribe((v) => (foes = v)),
      api.modules.subscribe((v) => (mods = v)),
      api.stats.subscribe((v) => (stats = v)),
      api.shuttles.subscribe((v) => (bays = v.bays)),
      api.combat.subscribe((v) => (combat = v)),
      api.inspect.subscribe((v) => (info = v)),
      api.selectedCrew.subscribe((v) => (selCrew = v)),
      api.selectedModule.subscribe((v) => (selMod = v)),
    ];
    return () => u.forEach((f) => f());
  });

  /** Clearing any selection returns to the ship view. */
  const back = () => api.selectCrew(null);
  const hasCrew = $derived(selCrew !== null && (crew.some((c) => c.id === selCrew) || foes.some((c) => c.id === selCrew)));
  const mod = $derived(selMod === null ? undefined : mods.find((m) => m.id === selMod));
  const tile = $derived(info?.selected ? info : null);
  const wide = $derived(!hasCrew && !!mod && (mod.crafting || !!mod.storage));
  const drafted = $derived(crew.filter((c) => c.drafted).length);
  const hurt = $derived(crew.filter((c) => !c.dead && c.hp < c.maxHp * 0.5).length);
  const short = $derived(stats.demand > stats.supply);
  const hover = $derived(info && !info.selected ? info : null);
</script>

<aside class="sheet sel" class:wide data-testid="selection-panel">
  {#if hasCrew}
    <CrewInspector {api} {onPriorities} onBack={back} />
  {:else if mod && bays.some((b) => b.id === mod.id)}
    <ShuttlePanel {api} onBack={back} />
  {:else if mod}
    <ModuleInspector {api} onBack={back} />
  {:else if tile}
    <TileInspector {api} onBack={back} />
  {:else}
    <div data-testid="ship-summary">
      <PanelHead icon="ship" title="Your ship" />
      <div class="grid">
        <span class="cell" class:warn={hurt > 0} title="Crew{drafted ? `, ${drafted} drafted` : ''}">
          <Icon name="person" size={18} /><b data-testid="sum-crew">{crew.length}</b>{#if drafted}<small>{drafted} drafted</small>{/if}
        </span>
        <span class="cell" title="Modules"><Icon name="module" size={18} /><b data-testid="sum-modules">{mods.length}</b></span>
        <span class="cell" class:warn={short} title="Power: supply / demand"><Icon name="power" size={18} /><b data-testid="sum-power">{stats.supply}/{stats.demand}</b></span>
        <span class="cell" title="Air pressure where crew stand"><Icon name="o2" size={18} /><b data-testid="sum-o2">{stats.o2 === null ? '--' : `${Math.round(stats.o2)} kPa`}</b></span>
      </div>
      {#if combat.player}<div class="meters"><ShipMeters ship={combat.player} compact /></div>{/if}
      <p class="hint" data-testid="sum-hover">
        {#if hover}<Icon name="grid" size={14} />{hover.x}, {hover.y} {hover.structName}{hover.room ? ` · room ${hover.room}` : ''}{:else}Select crew, a module or a tile.{/if}
      </p>
    </div>
  {/if}
</aside>

<style>
  .sel { left: calc(8px + var(--sal)); bottom: calc(8px + var(--sab)); width: 300px; max-height: calc(100vh - var(--hdr) - 24px); overflow-y: auto; }
  .sel.wide { width: 340px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .cell { display: flex; align-items: center; gap: 6px; padding: 6px 8px; background: var(--panel-2); border: 1px solid var(--line); color: var(--cyan); min-height: 20px; }
  .cell b { color: var(--text); font-weight: 600; }
  .cell small { color: var(--dim); font-size: 11px; }
  .cell.warn { border-color: var(--amber); color: var(--amber); }
  .meters { margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--line); }
  .hint { margin: 8px 0 0; color: var(--dim); font-size: 12px; display: flex; align-items: center; gap: 6px; min-height: 18px; }
  @media (max-width: 600px) { .sel, .sel.wide { width: auto; left: 0; right: calc(46px + var(--sar)); bottom: 0; max-height: 52vh; } }
</style>
