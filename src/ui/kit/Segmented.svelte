<script lang="ts">
  import { ToggleGroup } from 'bits-ui';
  import type { KitOption } from './types';

  /** A small fixed set of mutually exclusive choices, always one selected (the `button.on` look). */
  let { options, value, onChange, label = 'Choice', testId }: {
    options: KitOption[]; value: string; onChange: (v: string) => void; label?: string; testId?: string;
  } = $props();
</script>

<ToggleGroup.Root type="single" {value} onValueChange={(v) => v && v !== value && onChange(v)} class="kit-seg" aria-label={label} data-testid={testId}>
  {#each options as o (o.value)}
    <ToggleGroup.Item value={o.value} disabled={o.disabled} title={o.title} class={value === o.value ? 'on' : ''} data-testid={o.testId}>{o.label}</ToggleGroup.Item>
  {/each}
</ToggleGroup.Root>

<style>
  /* One joined group: no gap, neighbours share a border, the hovered, focused or selected one sits on top so its whole border shows. */
  :global(.kit-seg) { display: inline-flex; gap: 0; }
  :global(.kit-seg button + button) { margin-left: -1px; }
  :global(.kit-seg button) { position: relative; border-radius: 0; }
  :global(.kit-seg button:hover), :global(.kit-seg button:focus-visible), :global(.kit-seg button.on) { z-index: 1; }
  :global(.kit-seg button:focus-visible) { outline: 2px solid var(--focus); outline-offset: 1px; }
</style>
