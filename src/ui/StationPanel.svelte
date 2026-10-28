<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiJobs, UiTrade } from './api';
  import BlueprintList from './BlueprintList.svelte';
  import FloatingWindow from './FloatingWindow.svelte';
  import { centerTop } from './floatingWindow';
  import JobCards from './JobCards.svelte';
  import RecruitList from './RecruitList.svelte';
  import TradePane from './TradePane.svelte';
  import YardPane from './YardPane.svelte';

  /** A station's own panel (opened by selecting the station): Trade (the trade window's content), Jobs (the work posted at the node), Crew (people for hire). */
  let { api, station, onClose }: { api: UiApi; station: number; onClose: () => void } = $props();
  type Tab = 'trade' | 'jobs' | 'crew' | 'blueprints' | 'yard';
  let tab = $state<Tab>('trade');
  let trade = $state<UiTrade>({ credits: 0, partners: [], deals: [] });
  let jobs = $state<UiJobs>({ here: null, offers: [], active: [], handIn: [], max: 0, mine: null });
  let metal = $state(0);
  onMount(() => {
    const u = [api.trade.subscribe((t) => (trade = t)), api.jobs.subscribe((j) => (jobs = j)), api.stock.subscribe((s) => (metal = s.filter((x) => x.item === 'item.metal').reduce((n, x) => n + x.stored, 0)))];
    return () => u.forEach((f) => f());
  });
  const p = $derived(trade.partners.find((x) => x.id === station));
  const hiring = $derived(trade.deals.find((d) => d.ship === station && d.live && p?.recruits.some((r) => r.coming)));
  const tabs = $derived<{ id: Tab; label: string; n: number }[]>([
    { id: 'trade', label: 'Trade', n: 0 }, { id: 'jobs', label: 'Jobs', n: jobs.offers.length + jobs.handIn.length }, { id: 'crew', label: 'Crew', n: p?.recruits.length ?? 0 },
    ...(p?.info?.services.includes('Blueprints') ? [{ id: 'blueprints' as const, label: 'Blueprints', n: p.info.blueprints.filter((b) => !b.known).length }] : []),
    ...(p?.info?.yard ? [{ id: 'yard' as const, label: 'Shipyard', n: 0 }] : []),
  ]);
</script>

<FloatingWindow id="station" title={p?.name ?? 'Station'} titleTestId="station-title" icon="hull" min={{ w: 400, h: 320 }} defaultRect={(b) => { const r = centerTop(b, 520, Math.min(600, b.bottom - b.top)); return { ...r, y: (b.top + b.bottom - r.h) / 2 }; }} {onClose} closeLabel="Close station panel" closeTestId="station-close" testId="station-panel" padded>
  {#snippet titleExtra()}
    <small class="role">{p?.role ?? ''}</small>
    <span class="chip" data-testid="station-credits" title="Your credits">₵ {trade.credits}</span>
  {/snippet}
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
    {#if jobs.handIn.length}<JobCards {api} {jobs} list="handIn" />{/if}
    <JobCards {api} {jobs} list="offers" />
    <p class="note">You hold {jobs.active.length}/{jobs.max} jobs. The jobs button in the top bar lists them.</p>
    </div>
  {:else if tab === 'yard' && p.info?.yard}
    <div class="body"><YardPane {api} {station} yard={p.info.yard} credits={trade.credits} {metal} /></div>
  {:else if tab === 'blueprints' && p.info}
    <div class="body"><BlueprintList {api} port={p.info.blueprintPort} blueprints={p.info.blueprints} credits={trade.credits} /></div>
  {:else}
    <div class="body"><RecruitList {api} partner={p} credits={trade.credits} deal={hiring} /></div>
  {/if}
</FloatingWindow>

<style>
  .body { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
  .role { color: #9fd6ea; font: 12px var(--head-font); letter-spacing: 0.05em; white-space: nowrap; text-transform: none; }
  .chip { padding: 2px 8px; background: var(--bg); border: 1px solid var(--line); color: var(--amber); white-space: nowrap; font: inherit; letter-spacing: 0; }
  .tabs { flex: none; display: flex; gap: 2px; margin-bottom: 8px; border-bottom: 1px solid var(--line); }
  .tabs button { flex: 1; background: transparent; border: 0; border-bottom: 2px solid transparent; min-height: 32px; font: 600 12px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); }
  .tabs button.on { color: var(--cyan); border-bottom-color: var(--cyan); }
  .n { margin-left: 6px; color: var(--amber); }
  .none, .note { color: var(--dim); font-size: 12px; margin: 2px 0; }
  .note { margin-top: 8px; }
</style>
