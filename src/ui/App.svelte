<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCutaway, UiSnapshot } from './api';
  import DebugPanel from './DebugPanel.svelte';
  import TileInspector from './TileInspector.svelte';
  import ErrorOverlay from './ErrorOverlay.svelte';
  import './theme.css';

  let { api }: { api: UiApi } = $props();

  let canvas: HTMLCanvasElement;
  let debug = $state(false);
  let snap = $state<UiSnapshot | undefined>(undefined);

  let cutaway = $state<UiCutaway>('auto');
  let rooms = $state(false);
  const cutLabel: Record<UiCutaway, string> = { auto: 'Auto', up: 'Up', down: 'Down' };
  const cutNext: Record<UiCutaway, UiCutaway> = { auto: 'up', up: 'down', down: 'auto' };
  function cycleWalls() {
    cutaway = cutNext[cutaway];
    api.setCutaway(cutaway);
  }
  function cycleOverlay() {
    rooms = !rooms;
    api.setOverlay(rooms ? 'room' : null);
  }

  onMount(() => {
    const unsub = api.snapshot.subscribe((s) => (snap = s));
    api.attachCanvas(canvas);
    return unsub;
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
    <button onclick={cycleWalls}>Walls: {cutLabel[cutaway]}</button>
    <button class:on={rooms} onclick={cycleOverlay}>Overlay: {rooms ? 'Rooms' : 'Off'}</button>
  </span>
  <button class:on={debug} onclick={() => (debug = !debug)}>Debug</button>
</header>

{#if debug && snap}
  <DebugPanel {api} {snap} />
{/if}
<TileInspector {api} />
<ErrorOverlay {api} />

<style>
  canvas { position: fixed; inset: 0; width: 100%; height: 100%; display: block; }
  header {
    position: fixed; top: 0; left: 0; right: 0;
    display: flex; align-items: center; gap: 8px; justify-content: space-between;
    padding: calc(8px + var(--sat)) calc(8px + var(--sar)) 8px calc(8px + var(--sal));
    background: linear-gradient(var(--panel), transparent);
  }
  .tick { color: var(--cyan); min-width: 5.5em; }
  .speeds, .views { display: flex; gap: 4px; }
  @media (max-width: 600px) { .tick { display: none; } header { gap: 4px; } header button { padding: 0 8px; font-size: 12px; } }
</style>
