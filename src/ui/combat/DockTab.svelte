<script lang="ts">
  import Icon from '../Icon.svelte';
  import { KeyBadge } from '../kit';
  import type { IconName } from '../Icon.svelte';

  /**
   * A vertical tab on an end of the player's dock (Board on the left, Flee on the right): icon, label and key badge stacked in a
   * 60px column on the dock's backplane. `fill` (0..1) is a charge rising from the bottom; `ready` lights the green bar along the top;
   * `disabled` greys it out (`dim` more so, as a blocked action) and `note` is a small line under the key (why it is blocked).
   */
  let { icon, label, keyText, ready = false, disabled = false, dim = false, fill, note, tip, testid, lesson, onclick }: {
    icon: IconName;
    label: string;
    keyText: string;
    ready?: boolean;
    disabled?: boolean;
    dim?: boolean;
    fill?: number;
    note?: string | null;
    tip: string;
    testid: string;
    lesson?: string;
    onclick: () => void;
  } = $props();
  const pct = $derived(fill === undefined ? 0 : Math.min(100, Math.max(0, Math.round(fill * 100))));
</script>

<button class="tab" class:ready class:dim {disabled} title={tip} aria-label={label} data-testid={testid} data-lesson={lesson} {onclick}>
  {#if fill !== undefined}<span class="fill" style="height:{pct}%"></span>{/if}
  <span class="lab">
    <Icon name={icon} size={22} />
    <span>{label}</span>
    <KeyBadge tone={ready ? 'green' : disabled ? 'dim' : 'cyan'} size="sm">{keyText}</KeyBadge>
    {#if note}<small class="note" data-testid="board-blocker">{note}</small>{/if}
  </span>
</button>

<style>
  .tab {
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
  .note {
    max-width: 54px;
    font: 600 10px/1.1 var(--head-font);
    letter-spacing: 0.04em;
    text-align: center;
    color: var(--dim);
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
  .tab:disabled {
    opacity: 1;
  }
  .tab:disabled:not(.ready) .lab {
    opacity: 0.8;
  }
  .tab.dim:disabled .lab {
    opacity: 0.5;
  }
  .tab.ready:disabled {
    color: #fff;
  }
</style>
