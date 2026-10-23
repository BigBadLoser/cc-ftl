<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Tooltip } from 'bits-ui';

  /** Hover / keyboard-focus hint around any inline content. The trigger is a bare button, so the hint shows on keyboard focus too; use a native `title` only where no kit is needed. */
  let { text, children, side = 'top', label }: { text: string; children: Snippet; side?: 'top' | 'bottom' | 'left' | 'right'; label?: string } = $props();
</script>

<Tooltip.Provider delayDuration={250} disableHoverableContent>
  <Tooltip.Root>
    <Tooltip.Trigger class="kit-tip-trigger" aria-label={label}>
      {#snippet child({ props })}
        <button type="button" {...props}>{@render children()}</button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content class="kit-tip" {side} sideOffset={6} collisionPadding={8}>{text}</Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
</Tooltip.Provider>

<style>
  :global(.kit-tip-trigger) { display: block; min-height: 0; min-width: 0; padding: 0; margin: 0; background: none; border: 0; color: inherit; font: inherit; text-align: inherit; cursor: default; }
  :global(.kit-tip-trigger:focus-visible) { outline: 2px solid var(--focus); outline-offset: 1px; }
  :global(.kit-tip) { z-index: 60; max-width: min(260px, calc(100vw - 16px)); padding: 4px 8px; background: var(--panel-2); border: 1px solid var(--line-hi); border-radius: 0; color: var(--text); font-size: 12px; line-height: 1.35; pointer-events: none; }
</style>
