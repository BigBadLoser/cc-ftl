<script lang="ts" module>
  export type MenuPage = 'main' | 'save' | 'load' | 'controls' | 'settings' | 'newGame';
</script>

<script lang="ts">
  import Icon, { type IconName } from '../Icon.svelte';

  /** The Esc menu's first page: its items. `onPick` gets the page to open, or 'resume'. */
  let { onPick }: { onPick: (page: Exclude<MenuPage, 'main'> | 'resume') => void } = $props();
  const ITEMS: { page: Exclude<MenuPage, 'main'> | 'resume'; label: string; icon: IconName; testid: string }[] = [
    { page: 'resume', label: 'Resume', icon: 'play', testid: 'menu-resume' },
    { page: 'save', label: 'Save game', icon: 'save', testid: 'menu-save' },
    { page: 'load', label: 'Load game', icon: 'download', testid: 'menu-load' },
    { page: 'newGame', label: 'New game', icon: 'rotate', testid: 'menu-new' },
    { page: 'controls', label: 'Controls', icon: 'keyboard', testid: 'menu-controls' },
    { page: 'settings', label: 'Settings', icon: 'settings', testid: 'menu-settings' },
  ];
</script>

<nav class="items">
  {#each ITEMS as it (it.page)}
    <button class="item" class:interact={it.page === 'resume'} data-testid={it.testid} onclick={() => onPick(it.page)}>
      <Icon name={it.icon} size={18} />{it.label}
    </button>
  {/each}
</nav>

<style>
  .items {
    display: grid;
    gap: var(--sp-2);
    padding: var(--sp-1) 0;
  }
  .item {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    height: 44px;
    padding: 0 var(--sp-3);
    font: 600 16px var(--head-font);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-align: left;
  }
  .item:hover {
    border-color: var(--cyan);
  }
</style>
