<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Tabs } from 'bits-ui';
  import type { KitOption } from './types';

  /**
   * Tabs down the left side and one page beside them (the Esc menu's Settings and Controls). The selected tab gets the cyan interaction
   * edge, the rest are graphite; arrow keys move between tabs. The parent renders the page for `value` as `children`.
   */
  let { options, value, onChange, label = 'Sections', testId, children }: {
    options: KitOption[]; value: string; onChange: (v: string) => void; label?: string; testId?: string; children: Snippet;
  } = $props();
</script>

<Tabs.Root {value} onValueChange={(v) => v && v !== value && onChange(v)} orientation="vertical" class="kit-side" data-testid={testId}>
  <Tabs.List class="kit-side-list" aria-label={label}>
    {#each options as o (o.value)}
      <Tabs.Trigger value={o.value} disabled={o.disabled} class="kit-side-tab" data-testid={o.testId}>{o.label}</Tabs.Trigger>
    {/each}
  </Tabs.List>
  <Tabs.Content {value} class="kit-side-page">{@render children()}</Tabs.Content>
</Tabs.Root>

<style>
  :global(.kit-side) { display: grid; grid-template-columns: 184px minmax(0, 1fr); gap: var(--sp-3); min-height: 0; height: 100%; }
  :global(.kit-side-list) { display: flex; flex-direction: column; gap: 4px; border-right: 1px solid var(--line); padding-right: var(--sp-3); }
  :global(.kit-side-tab) {
    min-height: 36px; padding: 0 10px; text-align: left; background: var(--panel-2); border: 1px solid var(--btn-edge, var(--line)); color: var(--dim);
    font: 600 13px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase;
  }
  :global(.kit-side-tab:hover) { color: var(--text); border-color: var(--line-hi); }
  :global(.kit-side-tab[data-state='active']) { background: var(--panel-3); border-color: var(--cyan); color: #fff; }
  :global(.kit-side-tab:focus-visible) { outline: 2px solid var(--focus); outline-offset: 1px; }
  :global(.kit-side-page) { min-width: 0; min-height: 0; overflow-y: auto; outline: none; }
</style>
