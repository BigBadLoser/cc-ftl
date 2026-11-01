<script lang="ts" generics="P extends Record<string, unknown>">
  import { onDestroy, type Snippet } from 'svelte';
  import type { InspectorTab } from './tabs';
  import { inspectorWidth } from './width';

  /**
   * The generic tabbed inspector: a tab strip on top, then the selection's heading (`head`), then the open tab. The first
   * tab (the Overview) is the default; a tab with a `width` grows the inspector window to it, so the tabs swap the
   * window's content in place. Each selection type passes its own `tabs` and the `props` its tab components take.
   */
  let { tabs, props, head, testId = 'inspector-tabs' }: { tabs: InspectorTab<P>[]; props: P; head: Snippet; testId?: string } = $props();
  let open = $state<string | null>(null);
  const cur = $derived(tabs.find((t) => t.id === open) ?? tabs[0]);
  $effect(() => inspectorWidth.set(cur?.width ?? null));
  onDestroy(() => inspectorWidth.set(null));
</script>

{#if tabs.length > 1}
  <div class="tabs" role="tablist" data-testid={testId}>
    {#each tabs as t (t.id)}
      <button role="tab" aria-selected={t === cur} data-testid="tab-{t.id}" onclick={() => (open = t.id)}>{t.label}</button>
    {/each}
  </div>
{/if}
<div class="head" class:under={tabs.length > 1}>{@render head()}</div>
{#if cur}<cur.component {...props} />{/if}

<style>
  /* The strip spans the window's top edge (the body pads 10px). */
  .tabs { display: flex; margin: -10px -10px 0; height: 32px; }
  .tabs button { flex: 1 1 auto; min-width: 0; min-height: 0; height: 32px; padding: 0 6px; border: 0; border-right: 1px solid var(--line); background: var(--panel-2); color: var(--dim); font: 600 12px var(--head-font); letter-spacing: 0.04em; text-transform: uppercase; }
  .tabs button:last-child { border-right: 0; }
  .tabs button:hover { color: var(--text); border-color: var(--line); }
  /* Selected: the band colour of the heading below it (the tab and the heading read as one piece), white text. */
  .tabs button[aria-selected='true'] { background: var(--band); color: #fff; }
  .head.under :global(.ph) { margin-top: 0; padding-right: 10px; }
</style>
