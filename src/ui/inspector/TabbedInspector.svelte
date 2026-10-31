<script lang="ts" generics="P extends Record<string, unknown>">
  import type { InspectorTab } from './tabs';
  import ExpandedPanel from './ExpandedPanel.svelte';

  /**
   * The generic tabbed inspector: a tab strip under the selection's heading, the first inline tab (the Overview) shown by
   * default, and the expanded panel beside the inspector for a tab that has one. Clicking the open tab again goes back to
   * the Overview. Each selection type passes its own `tabs` and the `props` its tab components take.
   */
  let { tabs, props, title, testId = 'inspector-tabs' }: { tabs: InspectorTab<P>[]; props: P; title: string; testId?: string } = $props();
  let open = $state<string | null>(null);
  const first = $derived(tabs.find((t) => t.inline));
  const cur = $derived(tabs.find((t) => t.id === open));
  /** The inline tab on show: the open tab when it has one, else the Overview. */
  const inline = $derived(cur?.inline ? cur : first);
  const pick = (id: string) => (open = open === id || id === first?.id ? null : id);
</script>

{#if tabs.length > 1}
  <div class="tabs" role="tablist" data-testid={testId} style:--n={tabs.length}>
    {#each tabs as t (t.id)}
      {@const on = open === t.id || (open === null && t.id === first?.id)}
      <button role="tab" aria-selected={on} class:on title={t.label} data-testid="tab-{t.id}" onclick={() => pick(t.id)}>{t.label}</button>
    {/each}
  </div>
{/if}
{#if inline?.inline}<inline.inline {...props} />{/if}
{#if cur?.expanded}
  <ExpandedPanel title="{title} · {cur.label}" icon={cur.icon} onClose={() => (open = null)}><cur.expanded {...props} /></ExpandedPanel>
{/if}

<style>
  .tabs { display: grid; grid-template-columns: repeat(var(--n), 1fr); margin: -8px -10px 8px; border-bottom: 1px solid var(--line); }
  .tabs button { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-height: 30px; padding: 0 4px; border-width: 0 1px 0 0; background: var(--panel-2); color: var(--dim); font: 600 12px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; }
  .tabs button:last-child { border-right: 0; }
  .tabs button.on { background: var(--panel); color: #fff; box-shadow: inset 0 -2px 0 var(--cyan); }
</style>
