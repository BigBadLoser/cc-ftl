<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi } from '../api';
  import Icon from '../Icon.svelte';
  import { Dialog, Frame } from '../kit';
  import { holdModal } from '../keys';
  import MenuNav, { type MenuPage } from './MenuNav.svelte';
  import ControlsPage from './ControlsPage.svelte';
  import SavesPage from './SavesPage.svelte';
  import SettingsPage from './SettingsPage.svelte';

  /**
   * The Esc menu (DESIGN.md, UI soft rule 6): resume, save, load, new game, controls and settings, as pages with a back button. The App
   * pauses the game while it is open. Esc closes it from any page (not rebindable); while it is open the game's own keys stand aside.
   */
  let { api, onClose, start }: { api: UiApi; onClose: () => void; start?: 'save' } = $props();

  type Page = MenuPage;
  let page = $state<Page>(start ?? 'main');
  /** The Controls page is waiting for a key: it takes Esc too (to cancel the rebind). */
  let capturing = $state(false);
  // A new page: focus its Back button (the button that opened it is gone), so the keyboard stays in the menu.
  let body: HTMLElement | undefined = $state();
  $effect(() => {
    if (page !== 'main') body?.closest('.menu')?.querySelector<HTMLElement>('[data-testid=menu-back]')?.focus();
  });
  const TITLES: Record<Page, string> = { main: 'Menu', save: 'Save game', load: 'Load game', controls: 'Controls', settings: 'Settings', newGame: 'New game' };
  onMount(() => {
    const release = holdModal();
    const onKey = (e: KeyboardEvent) => {
      // The Dialog itself ignores Esc (and marks it handled), so this listener owns it. An open dropdown inside the menu gets it first.
      if (e.key !== 'Escape' || capturing || document.querySelector('.kit-sel-content')) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      release();
      window.removeEventListener('keydown', onKey);
      (document.activeElement as HTMLElement | null)?.blur?.(); // back to the game: no menu or HUD button keeps the keyboard
    };
  });
</script>

<!-- The kit Dialog moves focus in (Resume), traps it and keeps the background out of reach; Esc is handled above (not while rebinding). -->
<Dialog open bare dismissable={false} title={TITLES[page]} testId="esc-menu" initialFocus="[data-testid=menu-resume]" onCloseFocus={() => (document.activeElement as HTMLElement | null)?.blur?.()}>
<div class="menu steel" class:wide={page === 'controls' || page === 'settings'} class:mid={page === 'save' || page === 'load' || page === 'newGame'}>
  <Frame title={TITLES[page]}>
    {#snippet right()}
      {#if page !== 'main'}
        <button class="back" data-testid="menu-back" onclick={() => (page = 'main')}><Icon name="back" size={14} />Back</button>
      {:else}
        <button class="back" aria-label="Close menu" onclick={onClose}><Icon name="close" size={14} />Esc</button>
      {/if}
    {/snippet}
    <div class="body" bind:this={body}>
      {#if page === 'main'}
        <MenuNav onPick={(p) => (p === 'resume' ? onClose() : (page = p))} />
      {:else if page === 'newGame'}
        <div class="confirm">
          <p>Start a new game? <b>Progress since your last save is lost.</b> Your saved slots stay.</p>
          <div class="row">
            <button onclick={() => (page = 'main')}>Cancel</button>
            <button class="interact" data-testid="menu-new-confirm" onclick={() => api.newGame()}>Start a new game</button>
          </div>
        </div>
      {:else if page === 'save' || page === 'load'}
        <SavesPage {api} mode={page} />
      {:else if page === 'controls'}
        <ControlsPage onCapture={(on) => (capturing = on)} />
      {:else if page === 'settings'}
        <SettingsPage />
      {/if}
    </div>
  </Frame>
</div>
</Dialog>

<style>
  .menu {
    width: 300px;
    max-height: min(780px, calc(100vh - 80px));
    display: flex;
    pointer-events: auto;
    --frame-line: var(--line-hi);
  }
  .menu.mid {
    width: 500px;
  }
  .menu.wide {
    width: 760px;
  }
  /* Settings and Controls: one tab at a time in a fixed-height page, so the panel does not jump between tabs. */
  .menu.wide .body {
    height: 470px;
    overflow: hidden;
  }
  .menu > :global(.frame) {
    flex: 1;
    min-height: 0;
    background: var(--panel);
  }
  .body {
    overflow-y: auto;
    min-height: 0;
    padding: var(--sp-1) var(--sp-1) var(--sp-1);
  }
  .back {
    min-height: 0;
    height: 22px;
    padding: 0 6px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--panel);
    border: 1px solid var(--line-hi);
    color: var(--dim);
    font: 600 12px var(--head-font);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .back:hover {
    color: var(--text);
    border-color: var(--cyan);
  }
  .confirm p {
    margin: 4px 0 12px;
    line-height: 1.5;
  }
  .row {
    display: flex;
    justify-content: flex-end;
    gap: var(--sp-2);
  }
</style>
