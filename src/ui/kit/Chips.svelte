<script lang="ts">
  import { ToggleGroup } from 'bits-ui';
  import { tip } from './tip';
  import type { KitOption } from './types';

  /** A wrapping row of toggle chips: pick one (`multiple` false) or any number. `sub` shows dim text after the label. */
  type Props = {
    options: KitOption[]; label?: string; testId?: string;
    /** Single mode only: whether tapping the selected chip clears it (calls onChange('')). Default true. */
    deselect?: boolean;
  } & ({ multiple?: false; value: string; onChange: (v: string) => void } | { multiple: true; value: string[]; onChange: (v: string[]) => void });
  let { options, label = 'Options', testId, deselect = true, ...rest }: Props = $props();
  const isOn = (v: string) => (rest.multiple ? rest.value.includes(v) : rest.value === v);
</script>

{#snippet items()}
  {#each options as o (o.value)}
    <ToggleGroup.Item value={o.value} disabled={o.disabled} class={isOn(o.value) ? 'on' : ''} data-testid={o.testId}>
      {#snippet child({ props })}<button {...props} use:tip={{ text: o.title }}>{o.label}{#if o.sub}<small>{o.sub}</small>{/if}</button>{/snippet}
    </ToggleGroup.Item>
  {/each}
{/snippet}

{#if rest.multiple}
  <ToggleGroup.Root type="multiple" value={rest.value} onValueChange={(v) => rest.onChange(v)} class="kit-chips" aria-label={label} data-testid={testId}>{@render items()}</ToggleGroup.Root>
{:else}
  <ToggleGroup.Root type="single" value={rest.value} onValueChange={(v) => (v || deselect) && rest.onChange(v)} class="kit-chips" aria-label={label} data-testid={testId}>{@render items()}</ToggleGroup.Root>
{/if}

<style>
  :global(.kit-chips) { display: flex; flex-wrap: wrap; gap: 4px; }
  :global(.kit-chips button) { min-height: 34px; padding: 0 10px; display: flex; gap: 6px; align-items: center; }
  :global(.kit-chips small) { color: var(--dim); }
  :global(.kit-chips button:focus-visible) { outline: 2px solid var(--focus); outline-offset: 1px; }
</style>
