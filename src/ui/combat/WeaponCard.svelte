<script lang="ts">
  import Icon from '../Icon.svelte';
  import { KeyBadge, Meter, Pill } from '../kit';
  import type { UiWeapon } from '../api';

  /** One player weapon: hotkey, name, charge bar and target. Click to arm it, then click an enemy module in the world to aim. */
  let { weapon, label, hotkey, selected, onSelect, onMode, compact = false }: {
    weapon: UiWeapon;
    label: string;
    hotkey: string;
    /** One line (name, ammo) over the charge bar, no target line: for ships with more than four weapons. */
    compact?: boolean;
    selected: boolean;
    onSelect: () => void;
    onMode: (mode: 'auto' | 'hold') => void;
  } = $props();
  const own = $derived(weapon.target !== null);
  const aimText = $derived(selected ? 'click a module...' : own ? weapon.target : 'Ship');
  const held = $derived(weapon.mode === 'hold');
  const ready = $derived(held && weapon.charge >= 1 && weapon.powered && !weapon.ion);
  const flip = (e: Event) => {
    e.stopPropagation();
    onMode(held ? 'auto' : 'hold');
  };
  const chipTip = $derived(held ? 'HOLD: charges and waits for a volley (V) or an aim. Click for AUTO (Shift+hotkey)' : 'AUTO: fires when charged. Click for HOLD (Shift+hotkey)');
  const onKey = (e: KeyboardEvent) => {
    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onSelect();
    }
  };
  const tip = $derived(
    selected ? 'Click an enemy module in the world to aim this weapon (Esc cancels)' : 'Select, then click an enemy module to aim',
  );
</script>

<!-- A div, not a button: the mode chip inside is a button of its own. -->
<div
  class="wc"
  class:sel={selected}
  class:off={!weapon.powered}
  class:compact
  role="button"
  tabindex="0"
  aria-pressed={selected}
  data-testid="combat-weapon"
  data-mode={weapon.mode}
  title={compact && own ? `${tip}. Aimed at ${weapon.target}` : tip}
  onclick={onSelect}
  onkeydown={onKey}
>
  <span class="top">
    {#if hotkey}<KeyBadge>{hotkey}</KeyBadge>{/if}
    <span class="nm">{label}</span>
    {#if weapon.ammo !== null}<span class="am">x{weapon.ammo}</span>{/if}
    {#if compact}
      <button class="chip" data-testid="weapon-mode" title={chipTip} aria-label={held ? 'Hold' : 'Auto'} onclick={flip}><Pill tone={held ? 'amber' : 'cyan'}>{held ? 'H' : 'A'}</Pill></button>
    {/if}
  </span>
  {#if compact}
    <span class="cm"><Meter value={weapon.charge} fill={weapon.charge >= 1 ? 'var(--health-good)' : 'var(--amber)'} height={5} /></span>
  {:else}
    <Meter value={weapon.charge} fill={weapon.charge >= 1 ? 'var(--health-good)' : 'var(--amber)'} />
  {/if}
  {#if !compact}
    <span class="tg" class:own>
      <Icon name="target" size={12} />
      <span>{aimText}</span>
      {#if ready}<Pill tone="green">Ready</Pill>{/if}
      <button class="chip" data-testid="weapon-mode" title={chipTip} aria-label={held ? 'Hold' : 'Auto'} onclick={flip}><Pill tone={held ? 'amber' : 'cyan'}>{held ? 'Hold' : 'Auto'}</Pill></button>
    </span>
  {/if}
</div>

<style>
  .wc {
    min-height: 0;
    min-width: 0;
    padding: 6px var(--sp-2);
    display: grid;
    grid-template-rows: 30px 1fr 20px;
    gap: 5px;
    text-align: left;
    background: var(--panel-2);
    border: 1px solid var(--line);
    color: var(--text);
    cursor: pointer;
  }
  .wc:hover { border-color: var(--line-hi); }
  .wc.compact {
    position: relative;
    padding: 2px var(--sp-2) 12px;
    grid-template-rows: 1fr;
    overflow: hidden;
  }
  .cm { position: absolute; left: 6px; right: 6px; bottom: 3px; }
  .compact .nm { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .compact.sel .nm, .compact .nm { line-height: 1.2; }
  .wc.sel {
    border-color: var(--cyan);
    background: var(--panel-3);
    box-shadow: inset 0 0 0 1px var(--cyan), 0 0 10px rgba(54, 212, 255, 0.35);
  }
  .wc.off {
    opacity: 0.55;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .nm {
    flex: 1;
    min-width: 0;
    font: 600 14px/1.05 var(--head-font);
    letter-spacing: 0.03em;
  }
  .am {
    font-size: 11px;
    color: var(--dim);
  }
  .tg {
    display: flex;
    align-items: center;
    gap: var(--sp-1);
    font-size: 11px;
    color: var(--dim);
    min-width: 0;
  }
  .tg span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tg > :global(.pill), .chip :global(.pill) { margin: 0; }
  .chip { margin-left: auto; min-width: 0; min-height: 0; padding: 0; border: 0; background: transparent; cursor: pointer; flex: none; }
  .tg > span { flex: 1; min-width: 0; }
  .tg > :global(.pill) { flex: none; }
  .tg.own,
  .sel .tg {
    color: var(--cyan);
  }
</style>
