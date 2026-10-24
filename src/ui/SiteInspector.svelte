<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiSite } from './api';
  import Icon from './Icon.svelte';
  import ItemIcon from './ItemIcon.svelte';
  import PanelHead from './PanelHead.svelte';

  let { api, onBack }: { api: UiApi; onBack: () => void } = $props();
  let sites = $state<UiSite[]>([]);
  let sel = $state<number | null>(null);
  const s = $derived(sites.find((x) => x.id === sel));

  onMount(() => {
    const a = api.sites.subscribe((v) => (sites = v));
    const b = api.selectedSite.subscribe((v) => (sel = v));
    return () => (a(), b());
  });

  const pct = (x: UiSite) => Math.round(x.frac * 100);
  const secs = (n: number) => (n >= 60 ? `${Math.floor(n / 60)} min ${n % 60} s` : `${n} s`);
  const status = (x: UiSite) => (x.state === 'blocked' ? 'Stuck' : x.state === 'waiting' ? 'Waiting for materials' : x.builders.length ? 'Building' : 'Waiting for a builder');
  const names = (l: { name: string }[]) => (l.length ? l.map((c) => c.name).join(', ') : 'nobody');
</script>

{#if s}
  <div data-testid="site-inspector">
    <PanelHead icon="module" title="{s.name} (under construction)" sub="{s.local.x},{s.local.y}" {onBack} />
    <dl>
      <dt>Footprint</dt><dd>{s.w} x {s.h} tiles</dd>
      <dt>Status</dt><dd data-testid="site-state" class:bad={s.state === 'blocked'}>{status(s)}</dd>
      <dt>Progress</dt><dd data-testid="site-progress">{pct(s)}%</dd>
      <dt>Time left</dt><dd data-testid="site-eta">{s.etaSec === null ? 'no builder' : s.frac >= 1 ? 'finishing' : `about ${secs(s.etaSec)} of work`}</dd>
    </dl>
    <div class="bar" role="progressbar" aria-valuenow={pct(s)} aria-valuemin="0" aria-valuemax="100"><i style:width="{pct(s)}%"></i></div>
    {#if s.reason}<p class="why" data-testid="site-reason">{s.reason}</p>{/if}
    <h4>Materials</h4>
    <ul data-testid="site-materials">
      {#each s.materials as m (m.item)}
        <li class:short={m.missing > 0}>
          <ItemIcon {api} item={m.item} size={18} />
          <span class="n">{m.name}</span>
          <span class="q">{m.delivered}/{m.need}</span>
          {#if m.missing > 0}<small>{m.inTransit > 0 ? `${m.inTransit} on the way` : 'missing'}{m.missing > m.inTransit && m.inTransit > 0 ? `, ${m.missing - m.inTransit} to fetch` : ''}</small>{/if}
        </li>
      {:else}
        <li class="free">Free</li>
      {/each}
    </ul>
    <h4>Crew</h4>
    <dl>
      <dt>Building</dt><dd data-testid="site-builders">{names(s.builders)}</dd>
      <dt>Hauling</dt><dd>{names(s.haulers)}</dd>
    </dl>
    <div class="btns">
      <button class="warn wide" data-testid="site-cancel" title="Cancel the build; delivered materials drop back on the floor" onclick={() => { api.dispatch({ type: 'job.cancel', ship: s.ship, x: s.x, y: s.y }); api.selectSite(null); }}><Icon name="close" size={16} /> Cancel build</button>
    </div>
  </div>
{/if}

<style>
  dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; margin: 0 0 6px; }
  dt { color: var(--dim); } dd { margin: 0; text-align: right; }
  dd.bad { color: #ffb347; }
  h4 { margin: 10px 0 4px; font: 600 12px var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; color: var(--dim); }
  .why { margin: 6px 0 0; padding: 4px 6px; border: 1px solid #8a5a12; background: #2a1c06; color: #ffcf7a; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: center; gap: 6px; padding: 1px 0; }
  li .n { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  li .q { font-variant-numeric: tabular-nums; }
  li small { color: #ffcf7a; }
  li.short .q { color: #ffcf7a; }
  .free { color: var(--dim); }
  .btns { display: flex; gap: 4px; margin-top: 10px; }
  .warn { border-color: #7a2a2a; color: var(--red); display: inline-flex; align-items: center; gap: 6px; justify-content: center; }
  .wide { flex: 1; }
</style>
