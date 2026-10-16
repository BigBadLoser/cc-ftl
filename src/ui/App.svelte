<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCutaway, UiSnapshot, UiToolState } from './api';
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
  import ErrorOverlay from './ErrorOverlay.svelte';
  import './theme.css';

  let { api }: { api: UiApi } = $props();

  let canvas: HTMLCanvasElement;
  let debug = $state(false);
  let priorities = $state(false);
  let selCrew = $state<number | null>(null);
  let toast = $state<string | null>(null);
  let snap = $state<UiSnapshot | undefined>(undefined);

  let cutaway = $state<UiCutaway>('auto');
  let selMod = $state<number | null>(null);
  let tool = $state<UiToolState>({ tool: 'select', build: 'wall', moduleDef: null, rot: 0 });
  const cutLabel: Record<UiCutaway, string> = { auto: 'Auto', up: 'Up', down: 'Down' };
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
      api.selectedModule.subscribe((m) => (selMod = m)),
      api.tool.subscribe((t) => (tool = t)),
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
  <StatsChips {api} />
  <button class:on={debug} onclick={() => (debug = !debug)}>Debug</button>
</header>

{#if debug && snap}
  <DebugPanel {api} {snap} />
{/if}
<CrewBar {api} />
<ToolBar {api} />
{#if priorities}
  <PriorityGrid {api} onClose={() => (priorities = false)} />
{:else if tool.tool === 'build' && tool.build === 'module'}
  <BuildModules {api} />
{:else if selCrew !== null}
  <CrewInspector {api} onPriorities={() => (priorities = true)} />
{:else if selMod !== null}
  <ModuleInspector {api} />
{:else}
  <TileInspector {api} />
{/if}
{#if toast}<div class="toast" role="status" data-testid="toast">{toast}</div>{/if}
<AlertList {api} />
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
  .tick { color: var(--cyan); min-width: 5.5em; }
  .speeds, .views { display: flex; gap: 4px; }
  @media (max-width: 600px) { .tick { display: none; } .long { display: none; } header { padding-bottom: 4px; } header button { min-width: 34px; } header { gap: 4px; flex-wrap: wrap; justify-content: flex-start; } header button { padding: 0 8px; font-size: 12px; } .views { margin-left: auto; } }
</style>
