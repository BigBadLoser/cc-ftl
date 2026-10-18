<script lang="ts">
  import { onMount } from 'svelte';
  import { Struct } from '../sim';
  import type { UiApi, UiInspect, UiModule, UiSnapshot } from './api';
  import { copyText } from './clipboard';

  let { api, snap }: { api: UiApi; snap: UiSnapshot } = $props();
  let toast = $state('');
  let info = $state<UiInspect | null>(null);
  let mods = $state<UiModule[]>([]);
  onMount(() => {
    const a = api.inspect.subscribe((i) => (info = i));
    const b = api.modules.subscribe((m) => (mods = m));
    return () => (a(), b());
  });
  let roofed = $state(true);
  const toggleRoof = () => {
    roofed = !roofed;
    api.setRoofEnemies(roofed);
  };
  const tile = $derived(info?.selected ? info : null);
  const ignite = () => tile && api.dispatch({ type: 'debug.ignite', gridId: tile.gridId, x: tile.x, y: tile.y });
  const breach = () => tile && api.dispatch({ type: 'debug.setStruct', gridId: tile.gridId, x: tile.x, y: tile.y, kind: Struct.Space });
  const killReactor = () => {
    for (const m of mods) if (m.power > 0) api.dispatch({ type: 'module.setEnabled', id: m.id, enabled: false });
  };
  const reviveReactor = () => {
    for (const m of mods) if (m.power > 0) api.dispatch({ type: 'module.setEnabled', id: m.id, enabled: true });
  };

  async function repro() {
    const ok = await copyText(api.buildRepro());
    toast = ok ? 'Copied' : 'Copy failed';
    setTimeout(() => (toast = ''), 1500);
  }
</script>

<aside>
  <dl>
    <dt>FPS</dt><dd>{snap.fps.toFixed(0)}</dd>
    <dt>Frame</dt><dd>{snap.frameMs.toFixed(1)} ms</dd>
    <dt>Tick</dt><dd>{snap.tick}</dd>
    <dt>Tick time</dt><dd>{snap.tickMs.toFixed(3)} ms</dd>
    <dt>Zoom</dt><dd>{snap.zoom}</dd>
    <dt>Sprites</dt><dd>{snap.sprites}</dd>
    <dt>Entities</dt><dd>{snap.entityCount}</dd>
    <dt>Seed</dt><dd>{snap.seed}</dd>
  </dl>
  <div class="btns">
    <button data-testid="dbg-ignite" disabled={!tile} onclick={ignite}>Ignite selected tile</button>
    <button data-testid="dbg-breach" disabled={!tile} onclick={breach}>Breach selected tile</button>
    <button data-testid="dbg-kill-reactor" onclick={killReactor}>Kill reactor</button>
    <button data-testid="dbg-revive-reactor" onclick={reviveReactor}>Restore reactor</button>
    <button data-testid="dbg-spawn-raider" onclick={() => api.spawnRaider()}>Spawn raider</button>
    <button data-testid="dbg-spawn-scrapper" onclick={() => api.spawnGenerated('faction.scrapper')}>Gen scrapper</button>
    <button data-testid="dbg-spawn-drones" onclick={() => api.spawnGenerated('faction.drones')}>Gen drone</button>
    <button data-testid="dbg-spawn-navy" onclick={() => api.spawnGenerated('faction.navy')}>Gen navy</button>
    <button class:on={!roofed} data-testid="dbg-roof" onclick={toggleRoof}>{roofed ? 'Unroof enemies' : 'Roof enemies'}</button>
    <button onclick={repro}>Copy repro</button>
    <button onclick={() => api.throwTestError()}>Throw test error</button>
  </div>
  {#if toast}<div class="toast">{toast}</div>{/if}
</aside>

<style>
  aside { position: fixed; z-index: 6; top: calc(var(--hdr) + 236px + var(--sat)); right: calc(8px + var(--sar)); width: min(230px, calc(100vw - 16px)); background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 8px; max-height: calc(100vh - var(--hdr) - 250px); overflow-y: auto; }
  aside button { min-height: 34px; font-size: 12px; padding: 0 6px; }
  dl { display: grid; grid-template-columns: 1fr auto; gap: 1px 12px; margin: 0 0 8px; font-size: 12px; }
  dt { color: var(--dim); } dd { margin: 0; text-align: right; color: var(--cyan); }
  .btns { display: flex; flex-direction: column; gap: 4px; }
  .toast { margin-top: 8px; text-align: center; color: var(--cyan); }
  @media (max-width: 600px) { aside { top: calc(var(--hdr) + var(--sat) + 4px); right: 8px; left: 8px; width: auto; max-height: 52vh; } .btns { display: grid; grid-template-columns: 1fr 1fr; } dl { grid-template-columns: repeat(2, 1fr 1fr); } }
</style>
