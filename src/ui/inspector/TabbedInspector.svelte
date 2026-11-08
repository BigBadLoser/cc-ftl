<script lang="ts" generics="P extends Record<string, unknown>">
  import { onDestroy, type Snippet } from 'svelte';
  import { Tabs } from '../kit';
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
  <div class="tabs"><Tabs label="Inspector sections" testId={testId} options={tabs.map((t) => ({ value: t.id, label: t.label, testId: `tab-${t.id}` }))} value={cur?.id ?? ''} onChange={(v) => (open = v)} /></div>
{/if}
<div class="head" class:under={tabs.length > 1}>{@render head()}</div>
{#if cur}<cur.component {...props} />{/if}

<style>
  /* The strip spans the window's top edge (the body pads 10px). */
  .tabs { margin: -10px -10px 0; }
  .head.under :global(.ph) { margin-top: 0; padding-right: 10px; }
</style>
