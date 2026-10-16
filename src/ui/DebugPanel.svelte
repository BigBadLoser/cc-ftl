<script lang="ts">
  import type { UiApi, UiSnapshot } from './api';
  import { copyText } from './clipboard';

  let { api, snap }: { api: UiApi; snap: UiSnapshot } = $props();
  let toast = $state('');

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
    <dt>Draw calls</dt><dd>{snap.drawCalls}</dd>
    <dt>Triangles</dt><dd>{snap.triangles}</dd>
    <dt>Entities</dt><dd>{snap.entityCount}</dd>
    <dt>Seed</dt><dd>{snap.seed}</dd>
  </dl>
  <div class="btns">
    <button onclick={repro}>Copy repro</button>
    <button onclick={() => api.throwTestError()}>Throw test error</button>
  </div>
  {#if toast}<div class="toast">{toast}</div>{/if}
</aside>

<style>
  aside { position: fixed; top: calc(112px + var(--sat)); left: calc(8px + var(--sal)); width: min(260px, calc(100vw - 16px - var(--sal) - var(--sar))); background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px; }
  dl { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; margin: 0 0 10px; }
  dt { color: var(--dim); } dd { margin: 0; text-align: right; color: var(--cyan); }
  .btns { display: flex; flex-direction: column; gap: 6px; }
  .toast { margin-top: 8px; text-align: center; color: var(--cyan); }
</style>
