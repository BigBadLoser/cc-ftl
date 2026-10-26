<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiResearch, UiResearchNode } from './api';
  import Icon from './Icon.svelte';
  import ResearchSidebar from './ResearchSidebar.svelte';
  import ResearchTree from './ResearchTree.svelte';
  import { layoutResearch } from './researchLayout';

  let { api, onClose }: { api: UiApi; onClose: () => void } = $props();
  let rs = $state<UiResearch>({ ship: 0, labs: 0, workers: 0, bands: [], nodes: [], queue: [] });
  let selId = $state<string | null>(null);

  onMount(() => {
    // The game pauses while the tree is open and goes back to its speed on close.
    let speed: 0 | 1 | 2 | 3 = 0;
    api.snapshot.subscribe((s) => (speed = s.speed))();
    api.setSpeed(0);
    const stop = api.research.subscribe((v) => (rs = v));
    return () => {
      stop();
      if (speed !== 0) api.setSpeed(speed);
    };
  });

  const layout = $derived(layoutResearch(rs.nodes, rs.bands));
  const byId = $derived(new Map(rs.nodes.map((n) => [n.id, n])));
  /** Only researchable nodes (open, queued, active) can be picked or inspected. */
  const pickable = (n: UiResearchNode): boolean => n.project && (n.status === 'open' || n.status === 'queued' || n.status === 'active');
  const queued = $derived(rs.queue.map((id) => byId.get(id)).filter((n): n is UiResearchNode => !!n));
  const selected = $derived.by(() => {
    const n = selId ? byId.get(selId) : undefined;
    return n && pickable(n) ? n : (queued[0] ?? rs.nodes.find(pickable));
  });

  const queue = (project: string) => api.dispatch({ type: 'research.queue', ship: rs.ship, project });
  const cancel = (project: string) => api.dispatch({ type: 'research.cancel', ship: rs.ship, project });
  const move = (project: string, to: number) => api.dispatch({ type: 'research.move', ship: rs.ship, project, to });
</script>

<svelte:window onkeydowncapture={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }} />
<div class="rt" data-testid="research-panel" role="dialog" aria-label="Research">
  <div class="top">
    <Icon name="research" size={18} /><b>Research</b>
    <span class="chip" data-testid="research-labs">{rs.labs} {rs.labs === 1 ? 'module' : 'modules'}</span>
    <span class="chip p">Game paused</span>
    <button class="x" aria-label="Close" data-testid="research-close" onclick={onClose}><Icon name="close" size={20} /></button>
  </div>
  <div class="wrap">
    <ResearchSidebar {api} {rs} {selected} {queued} onAdd={queue} onCancel={cancel} onMove={move} />
    <ResearchTree {api} {layout} labs={rs.labs} selectedId={selected?.id ?? null} {pickable} onPick={(id) => (selId = id)} />
  </div>
</div>

<style>
  .rt { position: fixed; inset: 0; z-index: 30; background: #000; color: #e6e6e6; display: grid; grid-template-rows: 40px minmax(0, 1fr); font-size: 13px; pointer-events: auto; }
  .top { display: flex; align-items: center; gap: 10px; padding: 0 12px; border-bottom: 1px solid var(--amber); color: var(--amber); }
  .top b { font: 700 17px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; }
  .chip { font-size: 11px; color: #ffe2a6; border: 1px solid var(--amber); padding: 1px 6px; }
  .chip.p { border-color: #555; color: #aaa; }
  .x { margin-left: auto; min-width: 30px; width: 30px; min-height: 30px; height: 30px; padding: 0; display: inline-flex; align-items: center; justify-content: center; color: var(--amber); background: transparent; border-color: transparent; }
  .x:hover { border-color: var(--amber); }
  .wrap { display: grid; grid-template-columns: 340px minmax(0, 1fr); min-height: 0; }
</style>
