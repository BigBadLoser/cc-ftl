<script lang="ts">
  import type { Condition } from './blocks';
  import StatBar from './StatBar.svelte';

  /** Conditions of a body or a machine: a label, a bar when it has a level, and the readout, toned good/ok/warn/bad. */
  let { items, testId }: { items: Condition[]; testId?: string } = $props();
  const COLOR = { good: 'var(--green)', ok: 'var(--rest)', warn: 'var(--amber)', bad: 'var(--red)' } as const;
</script>

<ul data-testid={testId}>
  {#each items as c (c.key)}
    <li class={c.tone} data-testid="cond-{c.key}">
      <span class="l">{c.label}</span>
      {#if c.pct !== null}<StatBar value={c.pct} color={COLOR[c.tone]} />{:else}<span></span>{/if}
      <span class="v">{c.text}</span>
    </li>
  {:else}
    <li class="ok"><span class="l">Nothing to report</span></li>
  {/each}
</ul>

<style>
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 13px; }
  li { display: grid; grid-template-columns: 84px 1fr 150px; align-items: center; gap: 10px; }
  .l { color: var(--dim); }
  .v { text-align: right; color: var(--text); }
  li.warn .v { color: var(--amber); } li.bad .v { color: #ff9a9a; }
</style>
