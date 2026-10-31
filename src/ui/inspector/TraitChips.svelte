<script lang="ts">
  import type { TraitChip } from './blocks';
  import { Tooltip } from '../kit';

  /** Trait chips (#243's look): the name, coloured by kind, with the exact effect on hover; `detailed` lists the effect beside each. */
  let { traits, detailed = false, testId }: { traits: TraitChip[]; detailed?: boolean; testId?: string } = $props();
</script>

{#if detailed}
  <ul class="det" data-testid={testId}>
    {#each traits as t (t.id)}<li><span class="trait {t.kind}">{t.name}</span><span class="eff">{t.effect}<em>{t.flavour}</em></span></li>{/each}
  </ul>
{:else}
  <div class="row" data-testid={testId}>
    {#each traits as t (t.id)}
      <Tooltip text="{t.effect} {t.flavour}" label="{t.name}: {t.effect}"><span class="trait {t.kind}" data-testid="trait-{t.id}">{t.name}</span></Tooltip>
    {/each}
  </div>
{/if}

<style>
  .row { display: flex; flex-wrap: wrap; gap: 4px; }
  .trait { display: inline-block; justify-self: start; font: 600 11px/1 var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; padding: 4px 6px; border: 1px solid currentColor; background: var(--panel); color: var(--dim); cursor: help; }
  .trait.behaviour { color: var(--cyan); } .trait.tradeoff { color: var(--green); } .trait.phobia, .trait.habit { color: var(--amber); }
  .det { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  .det li { display: grid; grid-template-columns: 110px 1fr; gap: 10px; align-items: start; padding: 4px 6px; background: var(--panel-2); font-size: 12px; }
  .det .trait { cursor: default; }
  .eff { color: var(--text); }
  .eff em { display: block; color: var(--dim); font-size: 11px; }
</style>
