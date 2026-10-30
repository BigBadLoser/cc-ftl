<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Tooltip } from 'bits-ui';

  /** A button that is its own tooltip trigger (hover and keyboard focus), for controls that act when clicked; `Tooltip` wraps passive content. */
  let { text, children, side = 'bottom', class: cls = '', label, onclick, ...rest }: {
    text: string; children: Snippet; side?: 'top' | 'bottom' | 'left' | 'right'; class?: string; label?: string; onclick?: () => void; [k: string]: unknown;
  } = $props();
</script>

<Tooltip.Provider delayDuration={150} disableHoverableContent>
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <button type="button" {...rest} {...props} class={cls} aria-label={label} {onclick}>{@render children()}</button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content class="kit-tip" {side} sideOffset={6} collisionPadding={8}>{text}</Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
</Tooltip.Provider>
