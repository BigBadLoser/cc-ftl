<script lang="ts">
  import { onMount } from 'svelte';
  import { starters } from '../../content/starters';
  import type { UiApi } from '../api';
  import Icon, { type IconName } from '../Icon.svelte';
  import { Frame } from '../kit';
  import SavesPage from '../menu/SavesPage.svelte';
  import SettingsPage from '../menu/SettingsPage.svelte';
  import ShipPick from './ShipPick.svelte';
  import TitleStage from './TitleStage.svelte';
  import type { TitleApi } from './titleApi';
  import '../theme.css';

  /**
   * The title screen and the first steps of a new game (issue #240). One page at a time over a live backdrop; Back and Esc step back one
   * (Esc on the title itself does nothing). Continue, Load and Start reload the page into a game (app/saves.ts).
   */
  let { api }: { api: TitleApi } = $props();
  type View = 'main' | 'load' | 'settings' | 'ship' | 'crew';
  let view = $state<View>('main');
  let picked = $state(0);
  const starter = $derived(starters[picked] ?? starters[0]);
  /** Its own derived, so picking a card of the same ship template does not rebuild the backdrop. */
  const shipId = $derived(starter.ship);
  const canContinue = $derived(api.canContinue());
  const TITLES: Record<View, string> = { main: '', load: 'Load game', settings: 'Settings', ship: 'New game: choose a ship', crew: 'New game: crew' };
  const ITEMS: { id: View | 'continue'; label: string; icon: IconName; testid: string }[] = [
    { id: 'continue', label: 'Continue', icon: 'play', testid: 'title-continue' },
    { id: 'ship', label: 'New game', icon: 'rotate', testid: 'title-new' },
    { id: 'load', label: 'Load', icon: 'download', testid: 'title-load' },
    { id: 'settings', label: 'Settings', icon: 'settings', testid: 'title-settings' },
  ];
  const BACK: Record<View, View> = { main: 'main', load: 'main', settings: 'main', ship: 'main', crew: 'ship' };
  const back = () => (view = BACK[view]);

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || view === 'main' || document.querySelector('.kit-sel-content')) return;
      e.preventDefault();
      back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  // A page that came up: its Back button takes the focus, so Enter and Tab stay in the page.
  let panel: HTMLElement | undefined = $state();
  $effect(() => {
    if (view !== 'main') panel?.querySelector<HTMLElement>('[data-testid=title-back]')?.focus();
  });
  const wide = $derived(view === 'settings');
</script>

<TitleStage {api} ship={shipId} />
<div class="shade"></div>

<main class="title" data-testid="title-screen" data-view={view}>
  {#if view === 'main'}
    <header>
      <h1>cc-ftl</h1>
      <p>A ship. A crew. Everything else is out there.</p>
    </header>
    <nav class="items steel">
      {#each ITEMS as it (it.id)}
        {@const off = it.id === 'continue' && !canContinue}
        <button class="item" class:interact={it.id === 'continue' && canContinue} disabled={off} data-testid={it.testid}
          onclick={() => (it.id === 'continue' ? api.continueGame() : (view = it.id))}>
          <Icon name={it.icon} size={18} />{it.label}
        </button>
      {/each}
    </nav>
  {:else}
    <div class="panel steel" class:wide class:ships={view === 'ship' || view === 'crew'} bind:this={panel}>
      <Frame title={TITLES[view]}>
        {#snippet right()}
          <button class="back" data-testid="title-back" onclick={back}><Icon name="back" size={14} />Back</button>
        {/snippet}
        <div class="body">
          {#if view === 'load'}
            <SavesPage api={{ saves: api.saves } as unknown as UiApi} mode="load" />
          {:else if view === 'settings'}
            <div class="settings"><SettingsPage /></div>
          {:else if view === 'ship'}
            <ShipPick {starters} bind:picked onNext={() => (view = 'crew')} />
          {:else}
            <div class="crew" data-testid="title-crew">
              <p class="chosen">{starter.name} <span>{starter.tagline}</span></p>
              <p>The crew roll comes with traits: you will be able to reroll the whole crew or one member at a time, and rename them. Roles are fixed by the ship.</p>
              <p class="dim">Until then the {starter.name} sails with its stock crew.</p>
              <div class="row">
                <button onclick={back}>Back</button>
                <button class="interact" data-testid="title-start" onclick={() => api.startGame(starter.ship)}><Icon name="play" size={16} />Start</button>
              </div>
            </div>
          {/if}
        </div>
      </Frame>
    </div>
  {/if}
</main>

<style>
  .shade { position: fixed; inset: 0; pointer-events: none; background: linear-gradient(90deg, color-mix(in srgb, var(--bg) 82%, transparent) 0%, color-mix(in srgb, var(--bg) 30%, transparent) 42%, transparent 70%); }
  .title { position: fixed; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: 0 clamp(48px, 7vw, 140px); gap: 28px; pointer-events: none; }
  .title > * { pointer-events: auto; }
  h1 { margin: 0; font: 700 clamp(64px, 8vw, 120px) / 1 var(--pixel-font); letter-spacing: 0.06em; color: var(--text); text-shadow: 0 0 28px color-mix(in srgb, var(--cyan) 45%, transparent); }
  header p { margin: 10px 0 0 4px; color: var(--dim); font: 600 16px var(--head-font); letter-spacing: 0.14em; text-transform: uppercase; }
  .items { display: grid; gap: var(--sp-2); width: 300px; }
  .item { display: flex; align-items: center; gap: var(--sp-3); height: 46px; padding: 0 var(--sp-3); font: 600 16px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; text-align: left; }
  .item:hover:not(:disabled) { border-color: var(--cyan); }
  .item:disabled { opacity: 0.4; cursor: default; }
  .panel { width: 500px; max-height: min(780px, calc(100vh - 80px)); display: flex; }
  .panel.wide { width: 760px; }
  .panel.ships { width: 440px; }
  .panel > :global(.frame) { flex: 1; min-height: 0; background: var(--panel); --frame-line: var(--line-hi); }
  .panel.wide .body { height: 470px; overflow: hidden; }
  .body { overflow-y: auto; min-height: 0; padding: var(--sp-1); }
  .back { min-height: 0; height: 22px; padding: 0 6px; display: inline-flex; align-items: center; gap: 4px; background: var(--panel); border: 1px solid var(--line-hi); color: var(--dim); font: 600 12px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; }
  .back:hover { color: var(--text); border-color: var(--cyan); }
  .crew p { margin: 4px 0 12px; line-height: 1.5; }
  .crew .chosen { font: 600 18px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; }
  .crew .chosen span { color: var(--dim); font-size: 13px; margin-left: 8px; }
  .dim { color: var(--dim); }
  .row { display: flex; justify-content: flex-end; gap: var(--sp-2); }
  .row button { display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 0 16px; }
</style>
