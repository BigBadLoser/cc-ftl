<script lang="ts">
  import Icon from '../Icon.svelte';
  import { KeyBadge } from '../kit';
  import { anchor } from '../lessons/anchors';

  /**
   * Flee with its drive charge: a vertical tab docked to the right edge of the ship strip, the charge filling upward (cyan, green when
   * ready).
   */
  let { drive, onFlee }: {
    drive: { charge: number; max: number; helmManned: boolean; active: boolean };
    onFlee: () => void;
  } = $props();
  const ready = $derived(drive.charge >= drive.max && drive.active);
  const pct = $derived(Math.min(100, Math.round((drive.charge / drive.max) * 100)));
  const tip = $derived(
    ready
      ? 'Flee: jump out of the fight, then pick where to go on the starmap (F)'
      : drive.helmManned
        ? `Flee: drive charging ${Math.floor(drive.charge)}/${drive.max} s (F)`
        : 'Helm unmanned: the drive is not charging (F)',
  );
</script>

<button class="flee" class:ready disabled={!ready} title={tip} aria-label="Flee" data-testid="combat-flee" data-lesson={anchor('combat.flee')} onclick={onFlee}>
  <span class="fill" style="height:{pct}%"></span>
  <span class="lab">
    <Icon name="fast" size={22} />
    <span>Flee</span>
    <KeyBadge tone={ready ? 'green' : 'cyan'} size="sm">F</KeyBadge>
  </span>
</button>

<style>
  .flee {
    position: relative;
    flex: none;
    width: 60px;
    min-height: 0;
    min-width: 0;
    padding: 0;
    overflow: hidden;
    display: grid;
    place-items: center;
    font: 600 15px var(--head-font);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text);
    background: var(--panel-2);
    box-sizing: border-box;
    border: 1px solid var(--frame-line);
  }
  .lab {
    position: relative;
    z-index: 1;
    display: grid;
    justify-items: center;
    gap: 6px;
  }
  .fill {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(223, 228, 232, 0.05);
    box-shadow: inset 0 1px 0 rgba(223, 228, 232, 0.4);
  }
  .ready {
    color: #fff;
  }
  /* Ready is the green bar along the top edge alone: no green fill. */
  .ready .fill {
    background: transparent;
    box-shadow: inset 0 2px 0 var(--green);
  }
  .flee:disabled {
    opacity: 1;
  }
  .flee:disabled:not(.ready) .lab {
    opacity: 0.8;
  }
  .flee.ready:disabled {
    color: #fff;
  }
</style>
