<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon, { type IconName } from '../Icon.svelte';

  /** A titled block of an inspector tab: a small caps heading with a rule, an optional right-hand extra (a legend). */
  let { title, icon, testId, extra, children }: { title: string; icon?: IconName; testId?: string; extra?: Snippet; children: Snippet } = $props();
</script>

<section data-testid={testId}>
  <h3>{#if icon}<Icon name={icon} size={16} />{/if}{title}{#if extra}<span class="x">{@render extra()}</span>{/if}</h3>
  {@render children()}
</section>

<style>
  section { margin-bottom: 12px; }
  h3 { display: flex; align-items: center; gap: 6px; margin: 0 0 6px; padding-bottom: 3px; border-bottom: 1px solid var(--line); color: var(--dim); font: 600 12px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
  .x { margin-left: auto; text-transform: none; letter-spacing: 0.03em; font-weight: 400; }
</style>
