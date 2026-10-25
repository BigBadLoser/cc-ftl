<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiJob, UiJobs } from './api';

  let { api, onClose }: { api: UiApi; onClose: () => void } = $props();
  let jobs = $state<UiJobs>({ here: null, crew: [], credits: 0, offers: [], active: [], max: 0 });
  onMount(() => api.jobs.subscribe((v) => (jobs = v)));
  const full = $derived(jobs.active.length >= jobs.max);
  const far = (j: UiJob): string => (j.here ? 'here' : j.hops === null ? 'out of range' : `${j.hops} jump${j.hops === 1 ? '' : 's'}`);
</script>

<aside class="sheet" data-testid="jobs-panel">
  <div class="top"><h2>Jobs and crew</h2><button aria-label="Close" onclick={onClose}>×</button></div>

  <h3>Your jobs <span>{jobs.active.length}/{jobs.max}</span></h3>
  {#if !jobs.active.length}<p class="none">None taken. Stations, depots and dens post work.</p>{/if}
  <ul>
    {#each jobs.active as j (j.key)}
      <li class:due={j.turnsLeft <= 3} data-testid="job-active">
        <div class="t"><b>{j.title}</b><span class="pay">{j.reward} cr</span></div>
        <div class="d">{j.detail} · {far(j)} · {j.turnsLeft} turn{j.turnsLeft === 1 ? '' : 's'} left · for {j.issuer}</div>
        {#if j.kind === 'delivery' && !j.ready}<div class="warn">The crate is no longer aboard.</div>{/if}
        <button class="ghost" data-testid="job-abandon" onclick={() => j.id !== null && api.dispatch({ type: 'jobs.abandon', id: j.id })}>Abandon</button>
      </li>
    {/each}
  </ul>

  <h3>Offered here{#if jobs.here}<span>{jobs.here}</span>{/if}</h3>
  {#if jobs.here === null}
    <p class="none">Jobs are posted at stations: drop out of hyperspace to see them.</p>
  {:else if !jobs.offers.length}
    <p class="none">No work posted here.</p>
  {/if}
  <ul>
    {#each jobs.offers as j (j.key)}
      <li data-testid="job-offer">
        <div class="t"><b>{j.title}</b><span class="pay">{j.reward} cr</span></div>
        <div class="d">{j.detail} · {far(j)} · {j.turnsLeft} turns · for {j.issuer}</div>
        <button data-testid="job-accept" disabled={full} title={full ? `You hold ${jobs.max} jobs already` : ''} onclick={() => api.dispatch({ type: 'jobs.accept', key: j.key })}>Accept</button>
      </li>
    {/each}
  </ul>
  {#if jobs.crew.length}
    <h3>Crew for hire<span>{jobs.credits} cr</span></h3>
    <ul>
      {#each jobs.crew as r (r.key)}
        <li data-testid="recruit">
          <div class="t"><b>{r.name}</b><span class="pay">{r.cost} cr</span></div>
          <div class="d">{r.species} {r.role}{r.skills.length ? ` · ${r.skills.join(', ')}` : ''}</div>
          <button data-testid="recruit-hire" disabled={r.cost > jobs.credits} title={r.cost > jobs.credits ? `Costs ${r.cost - jobs.credits} credits more than you have` : ''} onclick={() => api.dispatch({ type: 'crew.hire', key: r.key })}>Hire</button>
          {#if r.cost > jobs.credits}<div class="warn">Not enough credits</div>{/if}
        </li>
      {/each}
    </ul>
  {/if}
  <p class="note">A delivery comes aboard as a sealed crate, set on deck apart from your hold. A missed one is broken open, its goods yours, but it costs standing with the issuer and marks you a thief (notoriety). Bounties pay when you destroy the target.</p>
</aside>

<style>
  aside { z-index: 6; box-sizing: border-box; top: calc(var(--hdr) + var(--sat) + 4px); left: 50%; transform: translateX(-50%); width: min(560px, calc(100vw - 16px)); max-height: calc(100dvh - var(--hdr) - var(--sat) - 16px); overflow-y: auto; }
  .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  h2 { margin: 0; font-size: 15px; color: var(--cyan); }
  .top button { min-height: 34px; min-width: 34px; padding: 0; font-size: 18px; }
  h3 { display: flex; justify-content: space-between; margin: 10px 0 4px; font: 600 12px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--cyan); }
  h3 span { color: var(--dim); text-transform: none; letter-spacing: 0; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  li { display: grid; gap: 3px; padding: 8px; background: var(--panel-2); border: 1px solid var(--line); }
  li.due { border-color: #ffb43c; }
  .t { display: flex; justify-content: space-between; gap: 8px; }
  .t b { color: var(--text); font-weight: 600; }
  .pay { color: #ffd77a; font-weight: 600; white-space: nowrap; }
  .d { color: var(--dim); font-size: 12px; }
  .warn { color: var(--red); font-size: 12px; }
  li button { justify-self: end; min-height: 30px; padding: 0 12px; }
  .none, .note { color: var(--dim); font-size: 12px; margin: 2px 0; }
  .note { margin-top: 10px; }
</style>
