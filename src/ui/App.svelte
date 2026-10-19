<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCombat, UiCutaway, UiPrize, UiShuttles, UiSnapshot, UiToolState } from './api';
  import CombatPanel from './CombatPanel.svelte';
  import PrizePanel from './PrizePanel.svelte';
  import ShuttlePanel from './ShuttlePanel.svelte';
  import DebugPanel from './DebugPanel.svelte';
  import TileInspector from './TileInspector.svelte';
  import CrewBar from './CrewBar.svelte';
  import CrewInspector from './CrewInspector.svelte';
  import PriorityGrid from './PriorityGrid.svelte';
  import ToolBar from './ToolBar.svelte';
  import AlertList from './AlertList.svelte';
  import BuildModules from './BuildModules.svelte';
  import ModuleInspector from './ModuleInspector.svelte';
  import OverlayPicker from './OverlayPicker.svelte';
  import StatsChips from './StatsChips.svelte';
  import StockDrawer from './StockDrawer.svelte';
  import ErrorOverlay from './ErrorOverlay.svelte';
  import StoryModal from './StoryModal.svelte';
  import StarmapView from './StarmapView.svelte';
  import './theme.css';

  let { api }: { api: UiApi } = $props();

  let canvas: HTMLCanvasElement;
  let debug = $state(false);
  let stockOpen = $state(false);
  let priorities = $state(false);
  let selCrew = $state<number | null>(null);
  let toast = $state<string | null>(null);
  let snap = $state<UiSnapshot | undefined>(undefined);
  let combat = $state<UiCombat>({ inCombat: false, player: null, enemies: [] });
  let combatOpen = $state(false);
  let wasInCombat = false;
  let shuttleOpen = $state(false);
  let mapOpen = $state(false);
  let prizeOpen = $state(false);
  let prizes = $state<UiPrize[]>([]);
  let shuttles = $state<UiShuttles>({ shuttles: [], airlocks: [], targets: [], roster: [], bays: [] });

  let cutaway = $state<UiCutaway>('auto');
  let selMod = $state<number | null>(null);
  let tool = $state<UiToolState>({ tool: 'select', build: 'wall', moduleDef: null, rot: 0 });
  $effect(() => {
    document.documentElement.toggleAttribute('data-combat', combat.inCombat && combatOpen);
  });
  const phone = () => window.matchMedia('(max-width: 600px)').matches;
  const cutLabel: Record<UiCutaway, string> = { auto: 'Cutaway', up: 'Up', down: 'Low' };
  const cutNext: Record<UiCutaway, UiCutaway> = { auto: 'up', up: 'down', down: 'auto' };
  function cycleWalls() {
    cutaway = cutNext[cutaway];
    api.setCutaway(cutaway);
  }

  onMount(() => {
    const unsubs = [
      api.snapshot.subscribe((s) => (snap = s)),
      api.selectedCrew.subscribe((c) => (selCrew = c)),
      api.toast.subscribe((t) => (toast = t)),
      api.selectedModule.subscribe((m) => {
        selMod = m;
        // Selecting a vehicle bay opens the shuttle panel.
        if (m !== null && shuttles.bays.some((b) => b.id === m)) shuttleOpen = true;
      }),
      api.shuttles.subscribe((v) => (shuttles = v)),
      api.prizes.subscribe((v) => {
        if (v.length > prizes.length) {
          prizeOpen = true; // a ship was just taken
          api.selectCrew(null);
        }
        prizes = v;
        if (!v.length) prizeOpen = false;
      }),
      api.tool.subscribe((t) => (tool = t)),
      api.combat.subscribe((c) => {
        combat = c;
        // The overlay opens by itself when a fight starts; closing it is the player's call until the next fight.
        if (c.inCombat && !wasInCombat) combatOpen = true;
        wasInCombat = c.inCombat;
      }),
    ];
    api.attachCanvas(canvas);
    return () => unsubs.forEach((u) => u());
  });

  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === ' ') {
      e.preventDefault();
      api.togglePause();
    } else if (e.key === '1' || e.key === '2' || e.key === '3') api.setSpeed(Number(e.key) as 1 | 2 | 3);
    else if (e.key === '`') debug = !debug;
    else if (e.key === 'm' && !mapOpen) mapOpen = true;
    else if (e.key === 'Escape') stockOpen = false;
  }

  const speeds: { label: string; speed: 0 | 1 | 2 | 3 }[] = [
    { label: '⏸', speed: 0 },
    { label: '1×', speed: 1 },
    { label: '2×', speed: 2 },
    { label: '3×', speed: 3 },
  ];
</script>

<svelte:window onkeydown={onKey} />

<canvas bind:this={canvas}></canvas>

<header>
  <span class="tick">Tick {snap?.tick ?? 0}</span>
  <span class="speeds">
    {#each speeds as s (s.speed)}
      <button class:on={snap?.speed === s.speed} aria-label={s.speed === 0 ? 'Pause' : `Speed ${s.label}`} onclick={() => api.setSpeed(s.speed)}>{s.label}</button>
    {/each}
  </span>
  <span class="views">
    <button onclick={cycleWalls}>Walls<span class="long">: {cutLabel[cutaway]}</span></button>
    <OverlayPicker {api} />
  </span>
  <StatsChips {api} {stockOpen} onStock={() => (stockOpen = !stockOpen)} />
  <span class="brk"></span>
  <span class="acts">
    <button class:on={mapOpen} data-testid="starmap-open" onclick={() => (mapOpen = !mapOpen)}><span class="long">Map</span><span class="short" aria-label="Starmap">✦</span></button>
    {#if shuttles.bays.length}
      <button class:on={shuttleOpen} data-testid="shuttle-open" onclick={() => { shuttleOpen = !shuttleOpen; if (shuttleOpen) { api.selectCrew(null); if (phone()) combatOpen = false; } }}><span class="long">Shuttle</span><span class="short" aria-label="Shuttle">🚀</span></button>
    {/if}
    {#if prizes.length}
      <button class:on={prizeOpen} data-testid="prize-open" onclick={() => { prizeOpen = !prizeOpen; if (prizeOpen) { api.selectCrew(null); if (phone()) combatOpen = false; } }}><span class="long">Prizes</span><span class="short" aria-label="Prizes">★</span></button>
    {/if}
    {#if combat.inCombat && !combatOpen}
      <button class="fight" data-testid="combat-open" onclick={() => { combatOpen = true; if (phone()) { shuttleOpen = false; prizeOpen = false; } }}>⚔<span class="long"> Combat</span></button>
    {/if}
  <button class:on={debug} onclick={() => (debug = !debug)}>Debug</button>
  </span>
</header>

{#if stockOpen}
  <StockDrawer {api} onClose={() => (stockOpen = false)} />
{/if}
{#if debug && snap}
  <DebugPanel {api} {snap} />
{/if}
{#if combat.inCombat && combatOpen}
  <CombatPanel {api} {combat} onClose={() => (combatOpen = false)} />
{/if}
<CrewBar {api} />
<ToolBar {api} />
{#if priorities}
  <PriorityGrid {api} onClose={() => (priorities = false)} />
{:else if tool.tool === 'build' && tool.build === 'module'}
  <BuildModules {api} />
{:else if selCrew !== null}
  <CrewInspector {api} onPriorities={() => (priorities = true)} />
{:else if prizeOpen}
  <PrizePanel {api} onClose={() => (prizeOpen = false)} />
{:else if shuttleOpen && (selMod === null || shuttles.bays.some((b) => b.id === selMod))}
  <ShuttlePanel {api} onClose={() => (shuttleOpen = false)} />
{:else if selMod !== null}
  <ModuleInspector {api} />
{:else}
  <TileInspector {api} />
{/if}
{#if toast}<div class="toast" role="status" data-testid="toast">{toast}</div>{/if}
<AlertList {api} />
{#if mapOpen}<StarmapView {api} onClose={() => (mapOpen = false)} />{/if}
<StoryModal {api} />
<ErrorOverlay {api} />

<style>
  canvas { position: fixed; inset: 0; width: 100%; height: 100%; display: block; }
  header {
    position: fixed; top: 0; left: 0; right: 0;
    display: flex; align-items: center; gap: 8px; justify-content: space-between;
    padding: calc(8px + var(--sat)) calc(8px + var(--sar)) 8px calc(8px + var(--sal));
    background: linear-gradient(var(--panel), transparent);
  }
  .toast { position: fixed; left: 50%; top: calc(var(--hdr) + 100px + var(--sat)); transform: translateX(-50%); max-width: calc(100vw - 32px); padding: 8px 14px; background: var(--panel); border: 1px solid var(--cyan); border-radius: 8px; pointer-events: none; z-index: 9; }
  /* The phone sheet leaves a transparent window for the enemy view; keep other overlays out of it. */
  @media (max-width: 600px) { :global(html[data-combat] .alerts), :global(html[data-combat] .tools), :global(html[data-combat] nav) { display: none; } }
  .fight { border-color: var(--red); color: #ffd0d0; }
  .short { display: none; }
  .acts { display: flex; gap: 8px; align-items: center; }
  .brk { display: none; }
  .tick { color: var(--cyan); min-width: 5.5em; }
  .speeds, .views { display: flex; gap: 4px; }
  @media (max-width: 600px) {
    .tick { display: none; } .long { display: none; } .short { display: inline; }
    header { padding-bottom: 4px; gap: 4px; flex-wrap: wrap; justify-content: flex-start; }
    header button { min-width: 32px; min-height: 34px; padding: 0 8px; font-size: 12px; }
    .views { margin-left: auto; }
    /* Row 1: speeds and views. Row 2: stats chips and the action buttons. */
    .brk { display: block; flex-basis: 100%; height: 0; order: 8; }
    .acts { order: 10; margin-left: auto; gap: 4px; }
  }
</style>
