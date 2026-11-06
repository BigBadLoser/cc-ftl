<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon, { type IconName } from '../Icon.svelte';

  /**
   * The one chip: a small caps label in the colour of its meaning, in a thin outline of that colour. `tone` is a role colour
   * (dim: plain, good: green, warn: amber, bad: red, gold: credits, select: cyan, the actionable or selected one). `size` sm
   * is 11px, md is 12px. `icon` leads the label; `outline` false drops the border for a filled tag. `swatch` is for domain palettes only (the starmap's danger scale and
   * faction tones, from `dangerColor` and `toneColor` in starmapStyle.ts, which read theme tokens): never pass a literal colour. It overrides the tone, `caps` false keeps the label's own case and `plate` gives
   * it an opaque panel and side margin, for a chip that sits on a frame's top edge.
   */
  let { tone = 'dim', size = 'sm', icon, outline = true, swatch, caps = true, plate = false, title, testId, children }: {
    tone?: 'dim' | 'good' | 'warn' | 'bad' | 'gold' | 'select';
    size?: 'sm' | 'md';
    icon?: IconName;
    outline?: boolean;
    swatch?: string;
    caps?: boolean;
    plate?: boolean;
    title?: string;
    testId?: string;
    children: Snippet;
  } = $props();
</script>

<span class="chip {tone} {size}" class:outline class:caps class:plate style:color={swatch} {title} data-testid={testId}>
  {#if icon}<Icon name={icon} size={size === 'sm' ? 12 : 14} />{/if}{@render children()}
</span>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    box-sizing: border-box;
    font-family: var(--head-font);
    font-weight: 600;
    letter-spacing: var(--ls-label);
    white-space: nowrap;
    color: var(--dim);
    border: 1px solid transparent;
  }
  .chip.sm { font-size: var(--fs-label); line-height: 1.3; padding: 1px 6px; }
  .chip.md { font-size: var(--fs-small); line-height: 1.3; padding: 2px 7px; }
  .caps { text-transform: uppercase; }
  .outline { border-color: var(--line-hi); }
  .good { color: var(--green); }
  .warn { color: var(--amber); }
  .bad { color: var(--red); }
  .gold { color: var(--gold); }
  .select { color: var(--cyan); }
  .outline.good, .outline.warn, .outline.bad, .outline.gold, .outline.select { border-color: currentColor; }
  .plate { background: var(--panel); margin: 0 4px; }
  .chip:not(.outline):not(.plate) { background: var(--panel-3); }
</style>
