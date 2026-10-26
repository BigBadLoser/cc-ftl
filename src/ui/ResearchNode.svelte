<script lang="ts">
  import { NODE_H, NODE_W, type PlacedNode } from './researchLayout';

  let { placed, selected, live, onPick }: { placed: PlacedNode; selected: boolean; live: boolean; onPick: () => void } = $props();
  const n = $derived(placed.node);
  const dur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const sub = $derived(n.status === 'known' ? 'Known' : n.status === 'locked' ? 'Locked' : n.status === 'active' ? 'Researching' : n.status === 'queued' ? 'Queued' : `${dur(n.seconds)} · research`);
</script>

<button class="node {n.status}" class:sel={selected} disabled={!live} style:left="{placed.x}px" style:top="{placed.y}px" style:width="{NODE_W}px" style:height="{NODE_H}px" data-testid="node-{n.id}" data-status={n.status} onclick={onPick}>
  <span class="t">{n.name}</span><small>{sub}</small>
  {#if n.pos !== null}<span class="badge">{n.pos + 1}</span>{/if}
  {#if n.status === 'active'}<span class="nbar"><i style:width="{Math.round(n.progress * 100)}%"></i></span>{/if}
</button>

<style>
  .node { position: absolute; z-index: 2; box-sizing: border-box; padding: 3px 9px; border: 1px solid; border-radius: 0; font: 600 14px var(--head-font); display: flex; flex-direction: column; justify-content: center; align-items: flex-start; text-align: left; line-height: 1.15; min-height: 0; min-width: 0; }
  .t { max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  small { font: 400 11px system-ui, sans-serif; }
  .node:disabled { opacity: 1; cursor: default; }
  .known { border-color: #3f8a55; background: #08160d; color: #8fd3a0; }
  .known small { color: #4f8a60; }
  .open, .queued, .active { border-color: var(--amber); background: #000; color: #ffe2a6; cursor: pointer; }
  .open small, .queued small, .active small { color: var(--amber); }
  .sel { box-shadow: 0 0 0 2px var(--amber), 0 0 14px rgba(240, 177, 58, 0.33); background: #000; }
  .locked { border-color: #2e2e2e; border-style: dashed; background: #080808; color: #5a5a5a; }
  .locked small { color: #444; }
  .badge { position: absolute; top: -9px; right: -9px; width: 18px; height: 18px; background: var(--amber); color: #000; font: 700 12px var(--head-font); display: grid; place-items: center; }
  .nbar { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: #2a2a2a; }
  .nbar i { display: block; height: 100%; background: var(--amber); }
</style>
