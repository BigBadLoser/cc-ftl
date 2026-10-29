<script lang="ts">
  import type { Snippet } from 'svelte';

  /** A small state tag: caps text in a thin outline of its own colour. */
  let { tone = 'dim', children }: { tone?: 'red' | 'amber' | 'green' | 'dim'; children: Snippet } = $props();
</script>

<span class="pill {tone}">{@render children()}</span>

<style>
  .pill {
    font: 600 11px/1 var(--head-font);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 3px 6px;
    border: 1px solid currentColor;
    margin: 0 4px;
    background: var(--panel);
    white-space: nowrap;
  }
  .red { color: var(--hostile); }
  .amber { color: var(--amber); }
  .green { color: var(--green); }
  .dim { color: var(--dim); }
</style>
