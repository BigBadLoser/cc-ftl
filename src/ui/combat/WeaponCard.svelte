<script lang="ts">
  import { KeyBadge, Meter } from '../kit';
  import type { UiWeapon } from '../api';

  /**
   * One player weapon: hotkey, name, charge bar and a bottom line that says what it aims at and what it does when charged. Click the card to
   * arm it, then click an enemy module in the world to aim; click the bottom line (or Shift + its hotkey) to flip AUTO / HOLD.
   * AUTO reads "Ship"; HOLD reads "HOLD · Ship" with the bar in amber, and "HOLD · READY" once a held weapon is charged. Compact cards
   * (five or more weapons) have no bottom line: hold is shown by the amber bar alone.
   */
  let { weapon, label, hotkey, selected, onSelect, onMode, compact = false }: {
    weapon: UiWeapon;
    label: string;
    hotkey: string;
    /** One line (name, ammo) over the charge bar, no bottom line: for ships with more than four weapons. */
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
  const modeTip = $derived(
    held
      ? 'HOLD: charges and waits for a volley (V) or an aim. Click for AUTO (Shift + hotkey)'
      : 'AUTO: fires when charged. Click for HOLD (Shift + hotkey)',
  );
  const onKey = (e: KeyboardEvent) => {
    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onSelect();
    }
  };
  const tip = $derived(
    selected ? 'Click an enemy module in the world to aim this weapon (Esc cancels)' : 'Select, then click an enemy module to aim',
  );
  const fill = $derived(held ? 'var(--amber)' : 'var(--hud-bar, var(--health-good))');
</script>

<!-- A div, not a button: the bottom line inside is a button of its own. -->
<div
  class="wc"
  class:sel={selected}
  class:off={!weapon.powered}
  class:compact
  class:held
  role="button"
  tabindex="0"
  aria-pressed={selected}
  data-testid="combat-weapon"
  data-mode={weapon.mode}
  title={compact ? `${tip}${held ? '. On HOLD' : ''}${own ? `. Aimed at ${weapon.target}` : ''}` : tip}
  onclick={onSelect}
  onkeydown={onKey}
>
  <span class="top">
    {#if hotkey}<KeyBadge>{hotkey}</KeyBadge>{/if}
    <span class="nm">{label}</span>
    {#if weapon.ammo !== null}<span class="am">×{weapon.ammo}</span>{/if}
  </span>
  {#if compact}
    <span class="cm"><Meter value={weapon.charge} {fill} height={4} edge="var(--track)" /></span>
  {:else}
    <Meter value={weapon.charge} {fill} height={4} edge="var(--track)" />
    <button class="sub" class:own data-testid="weapon-mode" title={modeTip} onclick={flip}>
      {#if held}<b class="hold">Hold</b>&nbsp;·&nbsp;{/if}{#if ready}<b class="rdy">Ready</b>{:else}{aimText}{/if}
    </button>
  {/if}
</div>

<style>
  .wc {
    min-height: 0;
    min-width: 0;
    padding: 7px 9px;
    display: grid;
    grid-template-rows: auto auto 1fr;
    align-content: center;
    gap: 7px;
    text-align: left;
    background: var(--panel-2);
    border: 1px solid transparent;
    color: var(--text);
    cursor: pointer;
  }
  .wc:hover { border-color: var(--line-hi); }
  .wc.sel {
    border-color: var(--cyan);
  }
  .wc.sel :global(kbd) {
    color: var(--cyan);
    border-color: var(--cyan);
  }
  .wc.compact {
    position: relative;
    padding: 2px 9px 12px;
    grid-template-rows: 1fr;
    overflow: hidden;
  }
  .cm { position: absolute; left: 9px; right: 9px; bottom: 5px; }
  .compact .nm { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
  .wc.off {
    opacity: 0.55;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }
  .nm {
    flex: 1;
    min-width: 0;
    font: 600 15px/1.1 var(--head-font);
    letter-spacing: 0.02em;
  }
  .am {
    font-size: 11px;
    color: var(--dim);
  }
  /* The bottom line: plain text that happens to be a button. */
  .sub {
    min-width: 0;
    min-height: 0;
    justify-self: start;
    max-width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    font: 600 10px/1 var(--head-font);
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--dim);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sub:hover { color: var(--text); border: 0; }
  .sub.own { color: var(--text); }
  .sub b { font-weight: 700; }
  .hold { color: var(--amber); }
  .rdy { color: var(--green); }
</style>
