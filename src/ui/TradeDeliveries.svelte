<script lang="ts">
  import type { UiApi, UiTradeDeal } from './api';

  /** Deliveries pinned to the bottom of the right column: every agreed deal with this partner, in order, with its trip progress and a Call off. */
  let { api, deals }: { api: UiApi; deals: UiTradeDeal[] } = $props();
  const live = $derived(deals.filter((d) => d.live));
  const last = $derived([...deals].reverse().find((d) => !d.live));
  const fmt = (n: number) => Math.abs(n).toLocaleString('en').replace(/,/g, ' ');
  const what = (d: UiTradeDeal) => [d.get && `buy ${d.get}`, d.give && `sell ${d.give}`].filter(Boolean).join(' · ') || 'delivery';
  /** Progress of the running deal through its trips and its current one (the phase). */
  const PHASES = ['dispatch', 'load', 'out', 'dockStation', 'stationWork', 'exchange', 'back', 'unload'];
  function progress(d: UiTradeDeal): number {
    if (d.phase === 'queued') return 0;
    const per = 1 / (d.trip?.of ?? 1);
    const at = Math.max(0, PHASES.indexOf(d.phase)) / PHASES.length;
    return Math.min(1, ((d.trip ? d.trip.n - 1 : 0) + at) * per);
  }
  const nth = (d: UiTradeDeal) => deals.filter((x) => x.live).indexOf(d) + 1;
</script>

<div class="dl" data-testid="trade-deliveries">
  <div class="sh">DELIVERIES{#if live.length}<span class="r">{live.length} {live.length === 1 ? 'DEAL' : 'DEALS'}</span>{/if}</div>
  {#each live as d (d.id)}
    <div class="q" data-testid="trade-status" data-deal={d.id}>
      <div class="t"><b>Deal {nth(d)}</b><span class="dim" data-testid={d.trip ? 'trade-trip' : undefined}>{d.trip ? `trip ${d.trip.n} of ${d.trip.of}${d.trip.stopped ? ' (stopped early)' : ''} · ` : ''}{d.status.toLowerCase()}</span></div>
      <div class="dim sm">{what(d)} · <span class="gold"><span class={d.balance < 0 ? 'good' : 'bad'}>{d.balance < 0 ? '+' : '−'}</span> ₵ {fmt(d.balance)}</span></div>
      <div class="row">
        <div class="mtr"><i style:width="{Math.round(progress(d) * 100)}%"></i></div>
        {#if d.cancellable}<button class="off" data-testid="trade-cancel-deal" onclick={() => api.dispatch({ type: 'trade.cancel', id: d.id })}>CALL OFF</button>{/if}
      </div>
    </div>
  {:else}
    <div class="q dim sm" data-testid="trade-none">No deliveries under way.</div>
  {/each}
  {#if !live.length && last}<div class="q dim sm" data-testid="trade-last">Last deal: {last.status}</div>{/if}
</div>

<style>
  .dl { border-top: 1px solid var(--line); flex: none; max-height: 45%; overflow-y: auto; }
  .sh { height: 34px; display: flex; align-items: center; padding: 0 10px; background: var(--panel-2); border-bottom: 1px solid var(--line); font: 600 12px var(--head-font); letter-spacing: 0.14em; color: var(--dim); position: sticky; top: 0; }
  .r { margin-left: auto; color: var(--green); }
  .q { padding: 8px 10px; border-bottom: 1px solid var(--line); }
  .t { display: flex; justify-content: space-between; gap: 8px; }
  .t span { text-align: right; font-size: 12px; }
  .sm { font-size: 12px; margin-top: 2px; }
  .dim { color: var(--dim); }
  .gold { color: var(--gold); }
  .good { color: var(--green); }
  .bad { color: var(--red); }
  .row { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
  .mtr { flex: 1; height: 5px; background: #080a0c; border: 1px solid var(--line); }
  .mtr i { display: block; height: 100%; background: #6f7a83; }
  .off { font: 700 11px var(--head-font); letter-spacing: 0.1em; padding: 2px 8px; min-height: 0; border: 1px solid var(--red); color: var(--red); background: transparent; cursor: pointer; }
</style>
