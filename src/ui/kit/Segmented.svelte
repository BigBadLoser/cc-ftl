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
  :global(.kit-seg) { display: inline-flex; gap: 4px; }
  :global(.kit-seg button:focus-visible) { outline: 2px solid var(--focus); outline-offset: 1px; }
</style>
