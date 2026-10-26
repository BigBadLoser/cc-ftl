<script lang="ts">
  import type { UiApi, UiResearchNode } from './api';
  import ResearchBand from './ResearchBand.svelte';
  import ResearchLinks from './ResearchLinks.svelte';
  import ResearchNode from './ResearchNode.svelte';
  import type { ResearchLayout } from './researchLayout';

  let { layout, labs, selectedId, pickable, onPick }: {
    api: UiApi; layout: ResearchLayout; labs: number; selectedId: string | null; pickable: (n: UiResearchNode) => boolean; onPick: (id: string) => void;
  } = $props();
  const inBand = $derived(layout.links.filter((l) => !l.cross));
  const cross = $derived(layout.links.filter((l) => l.cross));
</script>

<div class="tree" data-testid="research-tree">
  {#if labs === 0}<p class="nolab" data-testid="research-nolab">Build a research module to start.</p>{/if}
  <div class="canvas" style:width="{layout.width}px" style:height="{layout.height}px">
    {#each layout.bands as b (b.id)}<ResearchBand band={b} />{/each}
    <ResearchLinks links={inBand} width={layout.width} height={layout.height} />
    <!-- One overlay across the bands for links whose parent is in another category. -->
    <ResearchLinks links={cross} width={layout.width} height={layout.height} overlay />
    {#each layout.nodes as p (p.node.id)}
      <ResearchNode placed={p} selected={selectedId === p.node.id} live={pickable(p.node)} onPick={() => onPick(p.node.id)} />
    {/each}
  </div>
</div>

<style>
  .tree { position: relative; overflow: auto; padding: 14px 18px; background: #000; }
  .nolab { margin: 0 0 10px; color: var(--amber); }
  .canvas { position: relative; min-width: 100%; }
</style>
