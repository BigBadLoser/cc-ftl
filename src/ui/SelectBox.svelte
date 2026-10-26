<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi } from './api';

  let { api }: { api: UiApi } = $props();
  let box = $state<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  onMount(() => api.selectBox.subscribe((v) => (box = v)));
</script>

{#if box}
  <div class="box" data-testid="select-box" style:left="{box.x0}px" style:top="{box.y0}px" style:width="{box.x1 - box.x0}px" style:height="{box.y1 - box.y0}px"></div>
{/if}

<style>
  .box { position: fixed; z-index: 5; pointer-events: none; box-sizing: border-box; border: 1px solid var(--cyan, #22d3ee); background: rgba(34, 211, 238, 0.12); }
</style>
