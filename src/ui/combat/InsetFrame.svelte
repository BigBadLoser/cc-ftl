<script lang="ts">
  import type { UiApi } from '../api';

  /**
   * The combat inset: a docked window showing the other ship (yours by default, the enemy's once swapped). The renderer draws a second camera pass into
   * the world canvas behind this window every frame. The inset is never interactive except as the swap click. The frame pulses red while enemy shots are committed to your ship.
   */
  let { api, ship, title, threatened, onSwap }: {
    api: UiApi; ship: number; title: string; threatened: boolean; onSwap: () => void;
  } = $props();

  let win: HTMLElement | undefined = $state();
  $effect(() => {
    const el = win;
    const id = ship;
    api.setInset(el && id ? { ship: id, view: el } : null);
    return () => api.setInset(null);
  });
</script>

<button class="inset" class:hot={threatened} title="Swap the main view and the inset (Tab)" aria-label="Swap views" data-testid="combat-inset" onclick={onSwap}>
  <span class="head"><b>{title}</b><span class="sp"></span><kbd>Tab</kbd><span class="hint">swap</span></span>
  <span class="win" bind:this={win}></span>
</button>

<style>
  .inset { display: grid; grid-template-rows: auto 1fr; width: clamp(360px, 30vw, 560px); min-height: 0; min-width: 0; padding: 0; text-align: left; background: transparent; border: 1px solid var(--line-hi); color: var(--text); cursor: pointer; pointer-events: auto; }
  .inset.hot { border-color: var(--red); animation: pulse 0.9s ease-in-out infinite alternate; }
  .head { display: flex; align-items: center; gap: 8px; padding: 3px 8px; background: #0d4a66; font: 600 13px/1 var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; height: 20px; }
  .hot .head { background: #6a1c25; }
  .sp { flex: 1; }
  kbd { font: 700 10px/1 var(--head-font); padding: 2px 4px; border: 1px solid #a9d8ee; color: #d8f0ff; }
  .hint { font-size: 11px; color: #a9d8ee; letter-spacing: 0.05em; }
  /* A transparent window: the renderer draws the ship into the world canvas behind it. */
  .win { display: block; width: 100%; aspect-ratio: 16 / 9; }
  @keyframes pulse { to { box-shadow: 0 0 14px rgba(255, 90, 90, 0.7), inset 0 0 0 1px var(--red); } from { box-shadow: 0 0 0 rgba(255, 90, 90, 0); } }
</style>
