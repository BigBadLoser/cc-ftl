<script lang="ts">
  import type { Snippet } from 'svelte';

  /** A hotkey box. `tone` colours it (cyan, dim, green or light), `size` picks the type size. */
  let { tone = 'cyan', size = 'md', padX, children }: {
    tone?: 'cyan' | 'dim' | 'green' | 'light';
    size?: 'sm' | 'md';
    /** Horizontal padding in px, where a place needs something other than the size's default. */
    padX?: number;
    children: Snippet;
  } = $props();
</script>

<kbd class="{tone} {size}" style:padding-inline={padX === undefined ? undefined : `${padX}px`}>{@render children()}</kbd>

<style>
  kbd {
    font: 700 11px/1 var(--head-font);
    padding: 2px 5px;
    border: 1px solid var(--line-hi);
    background: var(--track);
  }
  kbd.sm {
    font-size: 10px;
    padding: 2px 4px;
  }
  .cyan { color: var(--cyan); }
  .dim { color: var(--dim); }
  .green { color: var(--green); border-color: var(--green); }
  .light {
    color: #d8f0ff;
    border-color: var(--light);
    background: transparent;
  }
</style>
