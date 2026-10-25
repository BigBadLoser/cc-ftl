<script lang="ts">
  import type { UiApi, UiJob, UiJobs } from './api';

  /** The job cards of the board: `active` the jobs the player holds, `offers` the work posted at the node. */
  let { api, jobs, list }: { api: UiApi; jobs: UiJobs; list: 'active' | 'offers' } = $props();
  const full = $derived(jobs.active.length >= jobs.max);
  const far = (j: UiJob): string => (j.here ? 'here' : j.hops === null ? 'out of range' : `${j.hops} jump${j.hops === 1 ? '' : 's'}`);
</script>

<ul>
  {#if list === 'active'}
    {#each jobs.active as j (j.key)}
      <li class:due={j.turnsLeft <= 3} data-testid="job-active">
        <div class="t"><b>{j.title}</b><span class="pay">{j.reward} cr</span></div>
        <div class="d">{j.detail} · {far(j)} · {j.turnsLeft} turn{j.turnsLeft === 1 ? '' : 's'} left · for {j.issuer}</div>
        {#if j.kind === 'delivery' && !j.ready}<div class="warn">The crate is no longer aboard.</div>{/if}
        <button class="ghost" data-testid="job-abandon" onclick={() => j.id !== null && api.dispatch({ type: 'jobs.abandon', id: j.id })}>Abandon</button>
      </li>
    {/each}
  {:else}
    {#each jobs.offers as j (j.key)}
      <li data-testid="job-offer">
        <div class="t"><b>{j.title}</b><span class="pay">{j.reward} cr</span></div>
        <div class="d">{j.detail} · {far(j)} · {j.turnsLeft} turns · for {j.issuer}</div>
        <button data-testid="job-accept" disabled={full} title={full ? `You hold ${jobs.max} jobs already` : ''} onclick={() => api.dispatch({ type: 'jobs.accept', key: j.key })}>Accept</button>
      </li>
    {/each}
  {/if}
</ul>

<style>
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  li { display: grid; gap: 3px; padding: 8px; background: var(--panel-2); border: 1px solid var(--line); }
  li.due { border-color: #ffb43c; }
  .t { display: flex; justify-content: space-between; gap: 8px; }
  .t b { color: var(--text); font-weight: 600; }
  .pay { color: #ffd77a; font-weight: 600; white-space: nowrap; }
  .d { color: var(--dim); font-size: 12px; }
  .warn { color: var(--red); font-size: 12px; }
  li button { justify-self: end; min-height: 30px; padding: 0 12px; }
</style>
