<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * A titled block of an inspector tab. It also sets the inspector grid every block inside lines up on: the label column
   * (`--ins-label`) and the right-aligned value column (`--ins-value`).
   */
  let { title, testId, extra, children }: { title?: string; testId?: string; extra?: Snippet; children: Snippet } = $props();
</script>

<section data-testid={testId}>
  {#if title}<h3>{title}{#if extra}<span class="x">{@render extra()}</span>{/if}</h3>{/if}
  {@render children()}
</section>

<style>
  section { --ins-label: 104px; --ins-value: 104px; --sb-label: var(--ins-label); --sb-value: var(--ins-value); }
  section:not(:first-child) { margin-top: 16px; }
  h3 { display: flex; align-items: baseline; margin: 0 0 6px; padding-bottom: 4px; border-bottom: 1px solid var(--line); color: var(--dim); font: 600 11px var(--head-font); letter-spacing: 0.1em; text-transform: uppercase; }
  .x { margin-left: auto; text-transform: none; letter-spacing: 0; font-weight: 400; }
</style>
