<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * A command button. `tone`: plain, `go` (the primary action once enabled), `active` (a toggle that is on) or `amber` (an effect
   * running). Disabled dims only the content and keeps the border at full strength. `progress` (0 to 1) draws a thin bar along the
   * bottom edge.
   * `layout` arranges the children: a `row` (icon, text, key) or a centred `stack` (two lines).
   */
  let { tone = 'plain', disabled = false, progress, layout = 'row', title, testid, onclick, children }: {
    tone?: 'plain' | 'go' | 'active' | 'amber';
    disabled?: boolean;
    progress?: number;
    layout?: 'row' | 'stack';
    title?: string;
    testid?: string;
    onclick: () => void;
    children: Snippet;
  } = $props();
</script>

<button class="btn {tone}" class:off={disabled} {disabled} {title} data-testid={testid} {onclick}>
  <span class="content {layout}">{@render children()}</span>
  {#if progress !== undefined}<i style:width="{Math.round(Math.max(0, Math.min(1, progress)) * 100)}%"></i>{/if}
</button>

<style>
  .btn {
    position: relative;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    min-height: 0;
    min-width: 0;
    padding: 0 2px;
    overflow: hidden;
    display: grid;
    place-items: center;
    opacity: 1;
    font: 600 15px var(--head-font);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .btn:disabled {
    opacity: 1;
    cursor: default;
  }
  .plain {
    border-color: var(--btn-edge, var(--line));
  }
  .btn.off .content {
    opacity: 0.4;
  }
  .go:not(:disabled) {
    background: var(--btn-go, var(--go));
    border-color: var(--btn-go-edge, var(--cyan));
    color: #fff;
  }
  .active {
    background: var(--panel-3);
    border-color: var(--btn-active-edge, var(--cyan));
    color: #fff;
  }
  .amber {
    background: var(--amber-fill);
    border-color: var(--amber);
    color: #fff;
  }
  .content.row {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
  }
  .content.stack {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 3px;
  }
  i {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 3px;
    background: var(--cyan);
  }
  .amber i {
    background: var(--amber);
  }
  .plain.off i {
    background: var(--line-hi);
  }
</style>
