<script lang="ts">
  import type { UiApi, UiResearch, UiResearchNode } from './api';
  import ResearchQueue from './ResearchQueue.svelte';
  import ResearchSelected from './ResearchSelected.svelte';

  let { api, rs, selected, queued, onAdd, onCancel, onMove }: {
    api: UiApi; rs: UiResearch; selected: UiResearchNode | undefined; queued: UiResearchNode[];
    onAdd: (id: string) => void; onCancel: (id: string) => void; onMove: (id: string, to: number) => void;
  } = $props();
</script>

<div class="side">
  <ResearchSelected {api} node={selected} labs={rs.labs} {onAdd} />
  <ResearchQueue {queued} workers={rs.workers} {onCancel} {onMove} />
</div>

<style>
  .side { border-right: 1px solid #2a2a2a; display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 0; }
</style>
