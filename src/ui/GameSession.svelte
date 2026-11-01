<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiSession } from './api';
  import { holdModal } from './keys';

  /**
   * The game's lifecycle on screen: the game-over screen when the ship or crew is lost (load the last save, or start over),
   * and a one-time notice when an old save could not be loaded.
   */
  let { api }: { api: UiApi } = $props();
  let session = $state<UiSession>({ notice: null, lost: null });
  const sm = $derived(session.summary ?? null);
  const clock = (sec: number) => {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h ? `${h} h ${m} min` : m ? `${m} min ${sec % 60} s` : `${sec} s`;
  };
  onMount(() => api.session.subscribe((v) => (session = v)));
  // The game-over screen is modal: game keys stand aside, and Esc does not open the menu under it.
  $effect(() => {
    if (session.lost) return holdModal();
  });
</script>

{#if session.lost}
  <div class="veil" data-testid="game-over">
    <div class="box" role="alertdialog" aria-modal="true" tabindex="-1" aria-labelledby="go-title" aria-describedby="go-text">
      <h2 id="go-title">Game over</h2>
      <p id="go-text">{session.lost}</p>
      {#if sm}
        <dl class="stats" data-testid="game-over-stats">
          <div><dt>Time survived</dt><dd>{clock(sm.seconds)}</dd></div>
          <div><dt>Jumps</dt><dd>{sm.jumps}</dd></div>
          <div><dt>Best credits</dt><dd>{sm.bestCredits.toLocaleString()}</dd></div>
          <div><dt>Credits at the end</dt><dd>{sm.credits.toLocaleString()}</dd></div>
        </dl>
      {/if}
      <div class="row">
        {#if sm?.hasPrecombat}<button data-testid="game-over-precombat" onclick={() => api.saves.load('precombat')}>Before combat</button>{/if}
        <button data-testid="game-over-load" onclick={() => api.loadLastSave()}>Last autosave</button>
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
  .box { box-sizing: border-box; width: min(420px, calc(100vw - 32px)); padding: 16px; background: var(--panel); border: 1px solid var(--red); text-align: center; }
  h2 { margin: 0 0 6px; font: 600 20px var(--pixel-font, var(--head-font)); letter-spacing: 0.08em; text-transform: uppercase; color: var(--red); }
  p { margin: 0 0 14px; color: var(--text); }
  .stats { margin: 0 0 16px; display: grid; gap: 4px; text-align: left; border-top: 1px solid var(--line); padding-top: 10px; }
  .stats div { display: flex; justify-content: space-between; gap: 12px; }
  .stats dt { color: var(--dim); font-size: 13px; }
  .stats dd { margin: 0; font: 600 14px var(--head-font); font-variant-numeric: tabular-nums; }
  .row { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 6px; }
  .row button { min-height: 40px; }
  .notice { position: fixed; z-index: 30; left: 50%; bottom: calc(16px + var(--sab, 0px)); transform: translateX(-50%); box-sizing: border-box; width: min(440px, calc(100vw - 32px)); display: flex; gap: 10px; align-items: center; padding: 10px 12px; background: var(--panel); border: 1px solid var(--amber); }
  .notice p { margin: 0; flex: 1; font-size: 13px; color: var(--text); text-align: left; }
  .notice button { min-height: 34px; padding: 0 14px; }
</style>
