<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiJobs, UiTrade } from './api';
  import JobCards from './JobCards.svelte';
  import RecruitList from './RecruitList.svelte';
  import TradePane from './TradePane.svelte';

  /** A station's own panel (opened by selecting the station): Trade (the trade window's content), Jobs (the work posted at the node), Crew (people for hire). */
  let { api, station, onClose }: { api: UiApi; station: number; onClose: () => void } = $props();
  type Tab = 'trade' | 'jobs' | 'crew';
  let tab = $state<Tab>('trade');
  let trade = $state<UiTrade>({ credits: 0, partners: [], deals: [] });
  let jobs = $state<UiJobs>({ here: null, offers: [], active: [], max: 0, mine: null });
  onMount(() => {
    const u = [api.trade.subscribe((t) => (trade = t)), api.jobs.subscribe((j) => (jobs = j))];
    return () => u.forEach((f) => f());
  });
  const p = $derived(trade.partners.find((x) => x.id === station));
  const hiring = $derived(trade.deals.find((d) => d.ship === station && d.live && p?.recruits.some((r) => r.coming)));
  const tabs = $derived<{ id: Tab; label: string; n: number }[]>([
    { id: 'trade', label: 'Trade', n: 0 }, { id: 'jobs', label: 'Jobs', n: jobs.offers.length }, { id: 'crew', label: 'Crew', n: p?.recruits.length ?? 0 },
  ]);
</script>

<aside class="sheet" data-testid="station-panel">
  <header>
    <div class="who">
      <h2 data-testid="station-title">{p?.name ?? 'Station'}</h2>
      <small>{p?.role ?? ''}</small>
    </div>
    <span class="chip" data-testid="station-credits" title="Your credits">₵ {trade.credits}</span>
    <button aria-label="Close station panel" data-testid="station-close" onclick={onClose}>×</button>
  </header>
  <div class="tabs" role="tablist">
    {#each tabs as t (t.id)}
      <button role="tab" aria-selected={tab === t.id} class:on={tab === t.id} data-testid="station-tab-{t.id}" onclick={() => (tab = t.id)}>{t.label}{#if t.n}<span class="n">{t.n}</span>{/if}</button>
    {/each}
  </div>
  {#if !p}
    <p class="none">Out of range.</p>
  {:else if tab === 'trade'}
    <TradePane {api} partner={station} {trade} compact />
  {:else if tab === 'jobs'}
    <div class="body">
    {#if jobs.here === null}<p class="none">Jobs cannot be taken now.</p>
    {:else if !jobs.offers.length}<p class="none">No work posted here.</p>{/if}
    <JobCards {api} {jobs} list="offers" />
    <p class="note">You hold {jobs.active.length}/{jobs.max} jobs. The jobs button in the top bar lists them.</p>
    </div>
  {:else}
    <div class="body"><RecruitList {api} partner={p} credits={trade.credits} deal={hiring} /></div>
  {/if}
</aside>

<style>
  aside { z-index: 6; box-sizing: border-box; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(520px, calc(100vw - 32px)); height: min(600px, calc(100dvh - var(--sat) - var(--sab) - 48px)); padding: 14px; display: flex; flex-direction: column; overflow: hidden; }
  .body { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
  header { flex: none; display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .who { flex: 1; min-width: 0; }
  h2 { margin: 0; font-size: 16px; color: var(--cyan); }
  .who small { color: var(--dim); }
  .chip { padding: 4px 8px; background: var(--bg); border: 1px solid var(--line); color: var(--amber); white-space: nowrap; }
  header button { min-width: 34px; min-height: 34px; padding: 0; font-size: 18px; }
  .tabs { flex: none; display: flex; gap: 2px; margin-bottom: 8px; border-bottom: 1px solid var(--line); }
  .tabs button { flex: 1; background: transparent; border: 0; border-bottom: 2px solid transparent; min-height: 32px; font: 600 12px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); }
  .tabs button.on { color: var(--cyan); border-bottom-color: var(--cyan); }
  .n { margin-left: 6px; color: var(--amber); }
  .none, .note { color: var(--dim); font-size: 12px; margin: 2px 0; }
  .note { margin-top: 8px; }
  @media (max-width: 600px) { aside { width: auto; height: auto; top: auto; left: 0; right: 0; transform: none; } }
</style>
