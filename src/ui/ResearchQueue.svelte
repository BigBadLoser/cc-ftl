<script lang="ts">
  import type { UiResearchNode } from './api';
  import Icon from './Icon.svelte';

  let { queued, workers, onCancel, onMove }: {
    queued: UiResearchNode[]; workers: number; onCancel: (id: string) => void; onMove: (id: string, to: number) => void;
  } = $props();

  function lineOf(n: UiResearchNode, i: number): string {
    if (n.status === 'active') return workers === 0 ? 'No one at the lab' : `${Math.round(n.progress * 100)}%`;
    return i === 0 ? 'Needs materials' : 'Waiting';
  }
  /** A project cannot go ahead of the one it builds on, nor the one before it below its dependent. */
  const canUp = (n: UiResearchNode, i: number): boolean => i > 0 && n.status !== 'active' && queued[i - 1]?.status !== 'active' && !n.parents.includes(queued[i - 1]?.id ?? '');
  const canDown = (n: UiResearchNode, i: number): boolean => i < queued.length - 1 && n.status !== 'active' && !queued[i + 1]?.parents.includes(n.id);
</script>

<div class="queue">
  <h3>Queue</h3>
  <div data-testid="research-queue">
    {#each queued as n, i (n.id)}
      <div class="q" class:on={n.status === 'active'} data-testid="queue-{n.id}">
        <div class="l1">
          <span class="n">{i + 1}</span><b>{n.name}</b><span class="st" class:bad={n.status !== 'active' && i === 0}>{lineOf(n, i)}</span>
          <span class="mv">
            <button aria-label="Move up" disabled={!canUp(n, i)} data-testid="up-{n.id}" onclick={() => onMove(n.id, i - 1)}><Icon name="chevUp" size={14} /></button>
            <button aria-label="Move down" disabled={!canDown(n, i)} data-testid="down-{n.id}" onclick={() => onMove(n.id, i + 1)}><Icon name="chevDown" size={14} /></button>
            <button class="rm" aria-label="Cancel" title={n.status === 'active' ? 'Cancel (materials come back)' : 'Remove'} data-testid="cancel-{n.id}" onclick={() => onCancel(n.id)}><Icon name="close" size={14} /></button>
          </span>
        </div>
        {#if n.status === 'active'}<div class="bar"><i style:width="{Math.round(n.progress * 100)}%"></i></div>{/if}
      </div>
    {:else}<p class="none">Nothing queued.</p>{/each}
  </div>
</div>

<style>
  h3 { margin: 0 0 6px; font: 600 12px var(--head-font); letter-spacing: 0.07em; text-transform: uppercase; color: var(--amber); border-bottom: 1px solid #262626; padding-bottom: 4px; }
  .queue { padding: 12px; overflow: auto; }
  .none { color: #8a8a8a; margin: 4px 0; }
  .q { border: 1px solid #242424; background: #0b0b0b; padding: 6px 8px; margin-bottom: 6px; }
  .q.on { border-color: var(--amber); background: #000; }
  .l1 { display: flex; align-items: center; gap: 8px; }
  .n { color: var(--amber); font: 700 13px var(--head-font); width: 12px; }
  .q b { color: #f2f2f2; font-weight: 600; }
  .st { margin-left: auto; color: var(--amber); white-space: nowrap; }
  .st.bad { color: var(--red); }
  .mv { display: inline-flex; gap: 3px; }
  .mv button { min-height: 26px; min-width: 26px; width: 26px; height: 26px; padding: 0; display: inline-flex; align-items: center; justify-content: center; background: #000; color: var(--amber); border: 1px solid #333; }
  .mv button:hover:not(:disabled) { border-color: var(--amber); }
  .mv .rm { color: var(--red); }
  .bar { height: 5px; margin-top: 5px; background: #1a1a1a; border: 1px solid #2c2c2c; }
  .bar i { display: block; height: 100%; background: var(--amber); }
</style>
