<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiJobs } from './api';
  import JobCards from './JobCards.svelte';

  /** The jobs board's content: the jobs asked by passengers, yours, finished ones to hand in, and the work posted here. */
  let { api }: { api: UiApi } = $props();
  let jobs = $state<UiJobs>({ here: null, offers: [], active: [], handIn: [], asked: [], max: 0, mine: null });
  onMount(() => api.jobs.subscribe((v) => (jobs = v)));
</script>
  {#if jobs.asked.length}
    <h3>Asked by passengers</h3>
    <JobCards {api} {jobs} list="asked" />
  {/if}

  <h3>Your jobs <span>{jobs.active.length}/{jobs.max}</span></h3>
  {#if !jobs.active.length}<p class="none">None taken. Stations, depots and dens post work.</p>{/if}
  <JobCards {api} {jobs} list="active" />

  {#if jobs.handIn.length}
    <h3>Ready to hand in</h3>
    <JobCards {api} {jobs} list="handIn" />
  {/if}

  <h3>Offered here{#if jobs.here}<span>{jobs.here}</span>{/if}</h3>
  {#if jobs.here === null}
    <p class="none">Jobs are posted at stations: drop out of hyperspace to see them.</p>
  {:else if !jobs.offers.length}
    <p class="none">No work posted here. Trade stations post deliveries, military stations and depots bounties, research stations surveys.</p>
  {/if}
  <JobCards {api} {jobs} list="offers" />

<style>
  h3 { display: flex; justify-content: space-between; margin: 10px 0 4px; font: 600 12px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-accent); }
  h3 span { color: var(--dim); text-transform: none; letter-spacing: 0; }
  .none { color: var(--dim); font-size: 12px; margin: 2px 0; }
</style>
