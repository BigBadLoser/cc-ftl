<script lang="ts">
  import type { UiApi, UiMining, UiPod } from './api';

  /** The player's mining pods with their state; with `asteroid`, each row offers Mine (that asteroid) or Recall. */
  let { api, mining, asteroid = 0 }: { api: UiApi; mining: UiMining; asteroid?: number } = $props();

  const status = (p: UiPod): string => {
    if (p.phase === 'waiting') return 'waiting for a pilot';
    if (p.phase === 'launching') return p.pilot ? 'launching' : 'pilot on the way';
    if (p.phase === 'unloading') return 'unloading';
    if (p.phase) return p.phase;
    return p.state === 'stowed' ? 'in its bay' : 'out';
  };
  const target = (p: UiPod) => mining.asteroids.find((a) => a.id === p.asteroid)?.name;
</script>

<ul class="pods" data-testid="pod-list">
  {#each mining.pods as p (p.id)}
    <li data-testid="pod-{p.id}">
      <div class="top">
        <span>{p.name}{#if p.pilot}<small> · {p.pilot}</small>{/if}</span>
        <span class="dim" data-testid="pod-status-{p.id}">{status(p)}</span>
      </div>
      <div class="bar" title="Hold {p.hold} / {p.cap}"><i style="width: {p.cap ? (100 * p.hold) / p.cap : 0}%"></i></div>
      <div class="bot">
        <small class="dim">Hold {p.hold}/{p.cap}{#if p.trips} · {p.trips} trip{p.trips === 1 ? '' : 's'}{/if}{#if p.asteroid && !asteroid} · {target(p) ?? ''}{/if}</small>
        {#if p.phase}
          <button data-testid="pod-recall-{p.id}" onclick={() => api.dispatch({ type: 'mining.recall', pod: p.id })}>Recall</button>
        {:else if asteroid}
          <button class="go" data-testid="pod-mine-{p.id}" onclick={() => api.dispatch({ type: 'mining.order', pod: p.id, asteroid })}>Mine</button>
        {/if}
      </div>
    </li>
  {:else}
    <li class="dim">No mining pods. Build a pod bay: it comes with a pod.</li>
  {/each}
</ul>

<style>
  .pods { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .top, .bot { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .top small { color: var(--dim); }
  .dim { color: var(--dim); }
  .bar { height: 4px; background: var(--panel-3); margin: 3px 0; }
  .bar i { display: block; height: 100%; background: var(--cyan); }
  .bot button { padding: 2px 10px; }
  .go { border-color: var(--cyan); }
</style>
