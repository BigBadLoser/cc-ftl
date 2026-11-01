<script lang="ts">
  import type { TraitChip } from './blocks';
  import { Tooltip } from '../kit';

  /**
   * Traits two ways. Chips (#243's look): the name in a box coloured by kind, the exact effect on hover; with `limit`, the
   * first few and a "+N" chip listing the rest on hover. `list`: one line each, a small colour block, the name and the short
   * effect, the full effect and flavour on hover.
   */
  let { traits, list = false, limit, testId }: { traits: TraitChip[]; list?: boolean; limit?: number; testId?: string } = $props();
  const shown = $derived(limit === undefined ? traits : traits.slice(0, limit));
  const rest = $derived(limit === undefined ? [] : traits.slice(limit));
</script>

{#if list}
  <ul data-testid={testId}>
    {#each traits as t (t.id)}
      <li title="{t.effect} {t.flavour}" data-testid="trait-line-{t.id}"><span class="tq {t.kind}">{t.name}</span><span class="short">{t.short ?? t.effect}</span></li>
    {/each}
  </ul>
{:else}
  <div class="row" data-testid={testId}>
    {#each shown as t (t.id)}
      <Tooltip text="{t.effect} {t.flavour}" label="{t.name}: {t.effect}"><span class="trait {t.kind}" data-testid="trait-{t.id}">{t.name}</span></Tooltip>
    {/each}
    {#if rest.length}
      <Tooltip text={rest.map((t) => `${t.name}: ${t.effect}`).join('\n')} label="{rest.length} more traits"><span class="trait more" data-testid="trait-more">+{rest.length}</span></Tooltip>
    {/if}
  </div>
{/if}

<style>
  .row { display: flex; flex-wrap: wrap; gap: 4px; }
  .trait { display: inline-block; font: 600 11px/1 var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; padding: 4px 6px; border: 1px solid currentColor; background: var(--panel); color: var(--dim); cursor: help; }
  .trait.behaviour { color: var(--cyan); } .trait.tradeoff { color: var(--green); } .trait.phobia, .trait.habit { color: var(--amber); }
  .trait.more { color: #fff; background: var(--band-tile); border-color: var(--line-hi); }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: grid; grid-template-columns: 96px 1fr; gap: 8px; align-items: center; min-height: 24px; border-bottom: 1px solid var(--panel-3); font-size: 12px; cursor: help; }
  .tq { display: inline-flex; align-items: center; gap: 6px; font: 600 11px/1 var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; color: #d6dbe0; }
  .tq::before { content: ''; width: 4px; height: 14px; background: var(--k, var(--dim)); }
  .tq.behaviour { --k: var(--cyan); } .tq.tradeoff { --k: var(--green); } .tq.phobia, .tq.habit { --k: var(--amber); } .tq.texture { --k: #8b939a; }
  .short { color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
