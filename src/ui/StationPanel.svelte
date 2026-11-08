<script lang="ts">
  import { Chip } from './kit';
  import { onMount } from 'svelte';
  import { anchor } from './lessons/anchors';
  import type { UiApi, UiJobs, UiTrade } from './api';
  import BlueprintList from './BlueprintList.svelte';
  import FloatingWindow from './FloatingWindow.svelte';
  import { centerTop } from './floatingWindow';
  import JobCards from './JobCards.svelte';
  import RecruitList from './RecruitList.svelte';
  import PaneHeader from './comms/PaneHeader.svelte';
  import Transcript from './comms/Transcript.svelte';
  import StationDock from './StationDock.svelte';
  import StationServices from './StationServices.svelte';
  import StationSensors from './StationSensors.svelte';
  import StationVideo from './StationVideo.svelte';
  import { contactFor, linesFor, servicesFor, type ServiceId } from './stationChannel';
  import YardPane from './YardPane.svelte';

  /**
   * A station's panel, an open comms channel with the station (selected station, "Hail station"): the contact of the open service on video, their
   * quote and the service's content in the middle, the station's sensors and the services on the right. Trade opens the trade window instead.
   */
  let { api, station, onClose, onTrade }: { api: UiApi; station: number; onClose: () => void; onTrade: (station: number) => void } = $props();
  let open = $state<ServiceId>('station');
  let trade = $state<UiTrade>({ credits: 0, partners: [], deals: [] });
  let jobs = $state<UiJobs>({ here: null, offers: [], active: [], handIn: [], asked: [], max: 0, mine: null });
  let metal = $state(0);
  onMount(() => {
    const u = [api.trade.subscribe((t) => (trade = t)), api.jobs.subscribe((j) => (jobs = j)), api.stock.subscribe((s) => (metal = s.filter((x) => x.item === 'item.metal').reduce((n, x) => n + x.stored, 0)))];
    return () => u.forEach((f) => f());
  });
  const p = $derived(trade.partners.find((x) => x.id === station));
  const hiring = $derived(trade.deals.find((d) => d.ship === station && d.live && p?.recruits.some((r) => r.coming)));
  const njobs = $derived(jobs.offers.length + jobs.handIn.length);
  const nhire = $derived(p?.recruits.length ?? 0);
  const services = $derived(p ? servicesFor(p, njobs, nhire) : []);
  const shown = $derived<ServiceId>(services.some((s) => s.id === open) ? open : 'station');
  const contact = $derived(contactFor(station, shown));
  const lines = $derived(p ? linesFor(shown, p, contact, njobs, nhire) : []);
  function pick(id: ServiceId) {
    if (id === 'trade') return onTrade(station);
    open = id;
  }
  const TIER = { friendly: 'good', neutral: 'dim', hostile: 'bad' } as const;
  const fmt = (n: number) => n.toLocaleString('en').replace(/,/g, ' ');
</script>

<FloatingWindow id="station" title="Channel open" titleFit icon="hull" min={{ w: 900, h: 420 }} defaultRect={(b) => centerTop(b, 1120)} {onClose} closeLabel="Close station panel" closeTestId="station-close" testId="station-panel" titleTestId="station-title">
  {#snippet titleExtra()}
    <span class="sub" data-testid="station-name">{p?.name ?? 'Station'}{p?.role ? ` · ${p.role}` : ''}</span>
    {#if p?.info?.owner}<Chip tone={TIER[p.info.owner.tier]} title="Owner and how they regard you" testId="si-owner">{p.info.owner.name} · {p.info.owner.tier}</Chip>{/if}
    {#if p?.market?.truce}<Chip tone={p.market.banned ? 'bad' : 'good'} title="Nobody starts a fight here. Firing on or boarding anyone breaks the truce.">{p.market.banned ? 'TRUCE BROKEN' : 'TRUCE'}</Chip>{/if}
    {#if p?.market}<Chip tone="warn" title={`${p.market.names.join(' · ')}. Contraband is bought at ${Math.round(p.market.contrabandRate * 100)}% of its value.`}>BLACK MARKET</Chip>{/if}
    <span class="credits"><Chip tone="gold" size="md" caps={false} outline={false} title="Your credits" testId="station-credits">₵ {fmt(trade.credits)}</Chip></span>
  {/snippet}
  {#if !p}
    <p class="none">Out of range.</p>
  {:else}
    <div class="cols" data-lesson={anchor('station.tabs')}>
      <div class="pane video"><StationVideo {api} {contact} station={p.name} /></div>
      <div class="pane comms">
        <PaneHeader label="COMMS" />
        <div class="body">
          <Transcript {lines} />
          {#if shown === 'station' && p.info}<StationDock info={p.info} />
          {:else if shown === 'jobs'}
            {#if jobs.here === null}<p class="note">Jobs cannot be taken now.</p>{/if}
            {#if jobs.handIn.length}<JobCards {api} {jobs} list="handIn" />{/if}
            <JobCards {api} {jobs} list="offers" />
            <p class="note">You hold {jobs.active.length}/{jobs.max} jobs. The jobs button in the top bar lists them.</p>
          {:else if shown === 'yard' && p.info?.yard}<YardPane {api} {station} yard={p.info.yard} credits={trade.credits} {metal} />
          {:else if shown === 'blueprints' && p.info}<BlueprintList {api} port={p.info.blueprintPort} blueprints={p.info.blueprints} credits={trade.credits} />
          {:else if shown === 'crew'}<RecruitList {api} partner={p} credits={trade.credits} deal={hiring} />{/if}
        </div>
      </div>
      <div class="pane sensors">
        {#if p.info}<StationSensors {api} name={p.name} info={p.info} />{/if}
        <StationServices {services} active={shown} onpick={pick} />
      </div>
    </div>
  {/if}
</FloatingWindow>

<style>
  .sub { color: var(--role-ink); font: 12px var(--head-font); letter-spacing: 0.05em; white-space: nowrap; text-transform: none; }
  .credits { margin-left: auto; }
  .cols { flex: 1 1 610px; min-height: 0; display: grid; grid-template-columns: 220px minmax(0, 1fr) 340px; }
  .pane { display: flex; flex-direction: column; min-width: 0; min-height: 0; border-right: 1px solid var(--line); overflow-y: auto; }
  .pane:last-child { border-right: 0; }
  .body { padding: 10px 12px; display: grid; gap: 10px; align-content: start; }
  .none, .note { color: var(--dim); font-size: 12px; margin: 8px 12px; }
</style>
