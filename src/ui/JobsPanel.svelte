<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiJobs } from './api';
  import FloatingWindow from './FloatingWindow.svelte';
  import { centerTop } from './floatingWindow';
  import JobCards from './JobCards.svelte';

  let { api, onClose }: { api: UiApi; onClose: () => void } = $props();
  let jobs = $state<UiJobs>({ here: null, offers: [], active: [], handIn: [], max: 0, mine: null });
  onMount(() => api.jobs.subscribe((v) => (jobs = v)));
</script>

<FloatingWindow id="jobs" title="Jobs" icon="list" min={{ w: 340, h: 160 }} defaultRect={(b) => centerTop(b, 560)} {onClose} testId="jobs-panel" closeTestId="jobs-close" padded>

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
    <p class="none">No work posted here.</p>
  {/if}
  <JobCards {api} {jobs} list="offers" />
  <p class="note">Trade stations post deliveries, military stations and depots bounties, research stations surveys. A delivery comes aboard as a sealed crate, set on deck apart from your hold; at the destination the station sends a shuttle, your crew carry the crate to the airlock and you are paid when it is taken. A missed one is broken open, its goods yours, but it costs standing with the issuer and marks you a thief (notoriety). A bounty or survey you finish is paid when you hand it in at a station of the same type and faction that posted it.</p>
</FloatingWindow>

<style>
  h3 { display: flex; justify-content: space-between; margin: 10px 0 4px; font: 600 12px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-accent); }
  h3 span { color: var(--dim); text-transform: none; letter-spacing: 0; }
  .none, .note { color: var(--dim); font-size: 12px; margin: 2px 0; }
  .note { margin-top: 10px; }
</style>
