<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiSession } from './api';

  /**
   * The game's lifecycle on screen: the game-over screen when the ship or crew is lost (load the last save, or start over),
   * and a one-time notice when an old save could not be loaded.
   */
  let { api }: { api: UiApi } = $props();
  let session = $state<UiSession>({ notice: null, lost: null });
  onMount(() => api.session.subscribe((v) => (session = v)));
</script>

{#if session.lost}
  <div class="veil" data-testid="game-over">
    <div class="box" role="alertdialog" aria-modal="true" tabindex="-1" aria-labelledby="go-title" aria-describedby="go-text">
      <h2 id="go-title">Game over</h2>
      <p id="go-text">{session.lost}</p>
      <div class="row">
        <button data-testid="game-over-load" onclick={() => api.loadLastSave()}>Load last save</button>
        <button data-testid="game-over-new" onclick={() => api.newGame()}>New game</button>
      </div>
    </div>
  </div>
{:else if session.notice}
  <div class="notice" role="status" data-testid="save-notice">
    <p>{session.notice}</p>
    <button aria-label="Dismiss" onclick={() => api.dismissNotice()}>OK</button>
  </div>
{/if}

<style>
  .veil { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; background: color-mix(in srgb, var(--bg) 78%, transparent); }
  .box { box-sizing: border-box; width: min(360px, calc(100vw - 32px)); padding: 16px; background: var(--panel); border: 1px solid var(--red); text-align: center; }
  h2 { margin: 0 0 6px; font: 600 20px var(--pixel-font, var(--head-font)); letter-spacing: 0.08em; text-transform: uppercase; color: var(--red); }
  p { margin: 0 0 14px; color: var(--text); }
  .row { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 6px; }
  .row button { min-height: 40px; }
  .notice { position: fixed; z-index: 30; left: 50%; bottom: calc(16px + var(--sab, 0px)); transform: translateX(-50%); box-sizing: border-box; width: min(440px, calc(100vw - 32px)); display: flex; gap: 10px; align-items: center; padding: 10px 12px; background: var(--panel); border: 1px solid var(--amber); }
  .notice p { margin: 0; flex: 1; font-size: 13px; color: var(--text); text-align: left; }
  .notice button { min-height: 34px; padding: 0 14px; }
</style>
