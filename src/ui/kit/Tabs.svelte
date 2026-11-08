<script lang="ts">
  import { Tabs } from 'bits-ui';
  import type { KitOption } from './types';

  /**
   * The horizontal tab strip of a window: tabs share the width, the open one takes the band colour (so the tab and the pane heading
   * under it read as one piece), arrow keys move between tabs. The parent renders the page for `value`; `SideTabs` is the vertical form.
   */
  let { options, value, onChange, label = 'Sections', testId }: {
    options: KitOption[]; value: string; onChange: (v: string) => void; label?: string; testId?: string;
  } = $props();
</script>

<Tabs.Root {value} onValueChange={(v) => v && v !== value && onChange(v)} class="kit-tabs-root">
  <Tabs.List class="kit-tabs" aria-label={label} data-testid={testId}>
    {#each options as o (o.value)}
      <Tabs.Trigger value={o.value} disabled={o.disabled} class="kit-tab" data-testid={o.testId}>{o.label}</Tabs.Trigger>
    {/each}
  </Tabs.List>
</Tabs.Root>

<style>
  :global(.kit-tabs) { display: flex; height: 32px; }
  :global(.kit-tab) { flex: 1 1 auto; min-width: 0; min-height: 0; height: 32px; padding: 0 6px; border: 0; border-right: 1px solid var(--line); background: var(--panel-2); color: var(--dim); font: 600 12px var(--head-font); letter-spacing: 0.04em; text-transform: uppercase; }
  :global(.kit-tab:last-child) { border-right: 0; }
  :global(.kit-tab:hover) { color: var(--text); }
  :global(.kit-tab[data-state='active']) { background: var(--band); color: #fff; }
  :global(.kit-tab:focus-visible) { outline: 2px solid var(--focus); outline-offset: -2px; }
</style>
