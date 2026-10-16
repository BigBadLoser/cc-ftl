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
    <button onclick={repro}>Copy repro</button>
    <button onclick={() => api.throwTestError()}>Throw test error</button>
  </div>
  {#if toast}<div class="toast">{toast}</div>{/if}
</aside>

<style>
  aside { position: fixed; top: calc(var(--hdr) + 56px + var(--sat)); left: calc(8px + var(--sal)); width: min(260px, calc(100vw - 16px - var(--sal) - var(--sar))); background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px; }
  dl { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; margin: 0 0 10px; }
  dt { color: var(--dim); } dd { margin: 0; text-align: right; color: var(--cyan); }
  .btns { display: flex; flex-direction: column; gap: 6px; }
  .toast { margin-top: 8px; text-align: center; color: var(--cyan); }
</style>
