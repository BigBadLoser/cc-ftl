<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiJobs } from './api';
  import JobCards from './JobCards.svelte';

  let { api, onClose }: { api: UiApi; onClose: () => void } = $props();
  let jobs = $state<UiJobs>({ here: null, offers: [], active: [], max: 0, mine: null });
  onMount(() => api.jobs.subscribe((v) => (jobs = v)));
</script>

<aside class="sheet" data-testid="jobs-panel">
  <div class="top"><h2>Jobs</h2><button aria-label="Close" onclick={onClose}>×</button></div>

  <h3>Your jobs <span>{jobs.active.length}/{jobs.max}</span></h3>
  {#if !jobs.active.length}<p class="none">None taken. Stations, depots and dens post work.</p>{/if}
  <JobCards {api} {jobs} list="active" />

  <h3>Offered here{#if jobs.here}<span>{jobs.here}</span>{/if}</h3>
  {#if jobs.here === null}
    <p class="none">Jobs are posted at stations: drop out of hyperspace to see them.</p>
  {:else if !jobs.offers.length}
    <p class="none">No work posted here.</p>
  {/if}
  <JobCards {api} {jobs} list="offers" />
  <p class="note">A delivery comes aboard as a sealed crate, set on deck apart from your hold. A missed one is broken open, its goods yours, but it costs standing with the issuer and marks you a thief (notoriety). Bounties pay when you destroy the target.</p>
</aside>

<style>
  /* A card in the top-right column, directly under the goals card (App places it there): in the flow, not a floating sheet. */
  /* A card in the top-right column, directly under the goals card (App places it there): in the flow, not a floating sheet.
     The job cards need more than the column's 260px, so on desktop it grows to the left, keeping its right edge. */
  aside { position: static; box-sizing: border-box; align-self: flex-end; width: min(380px, calc(100vw - 16px)); max-height: 44dvh; overflow-y: auto; border-width: 1px; padding: 8px 10px; }
  @media (max-width: 600px) { aside { align-self: stretch; width: auto; max-height: 40dvh; } }
  .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  h2 { margin: 0; font-size: 15px; color: var(--cyan); }
  .top button { min-height: 34px; min-width: 34px; padding: 0; font-size: 18px; }
  h3 { display: flex; justify-content: space-between; margin: 10px 0 4px; font: 600 12px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--cyan); }
  h3 span { color: var(--dim); text-transform: none; letter-spacing: 0; }
  .none, .note { color: var(--dim); font-size: 12px; margin: 2px 0; }
  .note { margin-top: 10px; }
</style>
