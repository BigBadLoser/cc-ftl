<script lang="ts">
  import type { Condition } from './blocks';
  import StatBar from './StatBar.svelte';

  /**
   * Conditions of a body or a machine on the inspector grid: the label column, a bar when it has a level (blank otherwise),
   * and the right-aligned readout, toned good/ok/warn/bad. Columns: `--ins-label`, `--ins-value` (see Section.svelte).
   */
  let { items, testId }: { items: Condition[]; testId?: string } = $props();
  const COLOR = { good: 'var(--green)', ok: 'var(--rest)', warn: 'var(--amber)', bad: 'var(--red)', dim: 'var(--dim)' } as const;
</script>

<ul data-testid={testId}>
  {#each items as c (c.key)}
    <li class={c.tone} data-testid="cond-{c.key}">
      <span class="l">{c.label}</span>
      {#if c.pct !== null}<StatBar value={c.pct} color={c.color ?? COLOR[c.tone]} /><span class="v">{c.text}</span>{:else}<span class="v wide" title={c.text}>{c.text}</span>{/if}
    </li>
  {:else}
    <li class="ok"><span class="l">Nothing to report</span></li>
  {/each}
</ul>

<style>
  ul { list-style: none; margin: 0; padding: 0; display: grid; }
  li { display: grid; grid-template-columns: var(--ins-label) 1fr var(--ins-value); align-items: center; gap: 10px; min-height: 24px; font-size: 13px; }
  .l { color: var(--dim); }
  .v { text-align: right; color: var(--text); white-space: nowrap; }
  li.warn .v { color: var(--amber); } li.bad .v { color: #ff9a9a; } li.dim .v { color: var(--dim); }
  /* A row without a bar: the text takes the bar's column too. */
  .v.wide { grid-column: 2 / 4; overflow: hidden; text-overflow: ellipsis; }
</style>
