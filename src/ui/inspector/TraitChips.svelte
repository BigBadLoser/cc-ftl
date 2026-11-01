<script lang="ts">
  import type { TraitChip } from './blocks';
  import { Tooltip } from '../kit';

  /**
   * Traits two ways. Chips (#243's look): the name in a box coloured by kind, the exact effect on hover; with `limit`, the
   * first few and a "+N" chip listing the rest on hover. `list`: one line each, a small colour block, the name and the short
   * effect, the full effect and flavour on hover.
   */
  let { traits, list = false, limit, fit, small = false, testId }: {
    traits: TraitChip[]; list?: boolean; limit?: number;
    /** One row of this many px: as many chips as fit, then "+N" (estimated from the name lengths). */
    fit?: number; small?: boolean; testId?: string;
  } = $props();
  /** Estimated chip width: caps at the chip font size, plus padding, border and the gap. */
  const chipW = (n: number) => n * (small ? 7.2 : 8.4) + (small ? 8 : 14) + 4;
  const count = $derived.by(() => {
    if (limit !== undefined) return limit;
    if (fit === undefined) return traits.length;
    let w = 0;
    for (let i = 0; i < traits.length; i++) {
      w += chipW(traits[i]!.name.length);
      const more = i + 1 < traits.length ? chipW(2) : 0;
      if (w + more > fit) return Math.max(1, i);
    }
    return traits.length;
  });
  const shown = $derived(traits.slice(0, count));
  const rest = $derived(traits.slice(count));
</script>

{#if list}
  <ul data-testid={testId}>
    {#each traits as t (t.id)}
      <li title="{t.effect} {t.flavour}" data-testid="trait-line-{t.id}"><span class="tq {t.kind}">{t.name}</span><span class="short">{t.short ?? t.effect}</span></li>
    {/each}
  </ul>
{:else}
  <div class="row" class:small data-testid={testId}>
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
  .small .trait { font-size: 10px; padding: 3px 4px; letter-spacing: 0.04em; }
  .row.small { flex-wrap: nowrap; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: grid; grid-template-columns: 96px 1fr; gap: 8px; align-items: center; min-height: 24px; border-bottom: 1px solid var(--panel-3); font-size: 12px; cursor: help; }
  .tq { display: inline-flex; align-items: center; gap: 6px; font: 600 11px/1 var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; color: #d6dbe0; }
  .tq::before { content: ''; width: 4px; height: 14px; background: var(--k, var(--dim)); }
  .tq.behaviour { --k: var(--cyan); } .tq.tradeoff { --k: var(--green); } .tq.phobia, .tq.habit { --k: var(--amber); } .tq.texture { --k: #8b939a; }
  .short { color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
