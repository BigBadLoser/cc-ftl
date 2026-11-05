<script lang="ts">
  import type { UiApi, UiTrade, UiTradePartner } from './api';
  import ItemIcon from './ItemIcon.svelte';
  import { summarize, tripsFor, type Draft } from './tradeDraft';

  /** The deal slip: reads the draft back, shows the total, and proposes it. A pending offer shows Accept and Withdraw here instead. */
  let { api, p, trade, draft = $bindable() }: { api: UiApi; p: UiTradePartner; trade: UiTrade; draft: Draft } = $props();

  const s = $derived(summarize(p.lines, draft));
  const empty = $derived(s.buy.length + s.sell.length === 0);
  const route = $derived(s.sellUnits > 0 ? p.out : p.in);
  const trips = $derived(tripsFor(s, route.cap));
  const MAX_TRIPS = 8;
  const REASONS: Record<string, string> = {
    noCourier: 'No shuttle to carry it: fit one in a bay', courierBusy: 'Your shuttle is busy', noAirlock: 'No free working airlock to dock at', noShip: 'No ship',
  };
  const problem = $derived.by(() => {
    if (empty) return 'Pick something to trade';
    if (s.balance > trade.credits) return 'Not enough credits';
    if (s.balance < 0 && -s.balance > p.wallet) return 'They cannot afford to pay that';
    if (route.error) return REASONS[route.error] ?? route.error;
    if (route.cap > 0 && trips > MAX_TRIPS) return `Too much: at most ${MAX_TRIPS} trips of ${route.cap} units`;
    return '';
  });
  const fmt = (n: number) => n.toLocaleString('en').replace(/,/g, ' ');
  const offer = $derived(p.offer);
  /** The pending offer read back line by line, at today's prices (the total above is the one the sim agreed). */
  const offerLines = $derived.by(() => {
    const o = offer;
    if (!o) return [];
    const row = (side: 'buy' | 'sell', l: { item: string; count: number }) => {
      const x = p.lines.find((y) => y.item === l.item);
      return { side, item: l.item, count: l.count, name: x?.name ?? api.items.find((i) => i.id === l.item)?.name ?? l.item, value: l.count * (side === 'buy' ? x?.sell ?? 0 : x?.buy ?? 0) };
    };
    return [...o.get.map((l) => row('buy', l)), ...o.give.map((l) => row('sell', l))];
  });
  const offerTrips = $derived.by(() => {
    const o = offer;
    const r = o && (o.give.length > 0 ? p.out : p.in);
    if (!o || !r || r.cap <= 0) return 0;
    return Math.ceil(Math.max(o.give.reduce((a, l) => a + l.count, 0), o.get.reduce((a, l) => a + l.count, 0)) / r.cap);
  });

  // Refuel: one click buys fuel up to REFUEL_TARGET units aboard (or what the shelf holds) through the normal offer, and accepts it when it appears.
  const REFUEL_TARGET = 24;
  const FUEL = 'item.fuel';
  const fuelLine = $derived(p.station && p.info?.services.includes('Fuel') ? p.lines.find((l) => l.item === FUEL) : undefined);
  const refuel = $derived.by(() => {
    if (!fuelLine || (fuelLine.theirsFree ?? fuelLine.theirs) <= 0) return null;
    const n = Math.min(fuelLine.theirsFree ?? fuelLine.theirs, Math.max(0, REFUEL_TARGET - fuelLine.mine));
    return { n, cost: n * fuelLine.sell };
  });
  let refuelling = $state(false);
  function doRefuel() {
    if (!refuel || refuel.n <= 0) return;
    refuelling = true;
    api.dispatch({ type: 'trade.offer', ship: p.id, give: [], get: [{ item: FUEL, count: refuel.n }], barter: false });
  }
  $effect(() => {
    // The refuel offer has appeared: accept it. Anything else on the table is left alone.
    const o = p.offer;
    if (refuelling && o) {
      refuelling = false;
      if (o.get.length === 1 && o.get[0]?.item === FUEL && o.give.length === 0) api.dispatch({ type: 'trade.accept', offer: o.id });
    }
  });
  const refuelOff = $derived(!refuel || refuel.n <= 0 || refuel.cost > (trade.free ?? trade.credits) || !!p.offer || !!p.in.error);
  const refuelTip = $derived(!refuel ? '' : refuel.n <= 0 ? 'Tanks are full enough' : p.offer ? 'Answer the offer on the table first' : refuel.cost > (trade.free ?? trade.credits) ? 'Not enough credits' : p.in.error ? (REASONS[p.in.error] ?? p.in.error) : `You hold ${fuelLine?.mine ?? 0}. The shuttle brings it over.`);

  function propose() {
    const toLines = (a: { item: string; count: number }[]) => a.map(({ item, count }) => ({ item, count }));
    api.dispatch({ type: 'trade.offer', ship: p.id, give: toLines(s.sell), get: toLines(s.buy), barter: false });
    draft = {};
  }
</script>

<div class="slip" data-testid="trade-slip">
  <div class="sh">{offer ? 'PROPOSED DEAL' : 'THIS DEAL'}</div>
  {#if offer}
    <div class="body" data-testid="trade-offer">
      {#each offerLines as l (l.side + l.item)}
        <div class="sl"><ItemIcon {api} item={l.item} size={22} /><span><span class="dim">{l.side === 'buy' ? 'Buy' : 'Sell'}</span> {l.count} {l.name.toLowerCase()}</span><span class="gold"><span class={l.side === 'buy' ? 'bad' : 'good'}>{l.side === 'buy' ? '−' : '+'}</span> ₵ {fmt(l.value)}</span></div>
      {/each}
      <div class="tot"><b>{offer.balance > 0 ? 'You pay' : 'You get'}</b><b class="gold">₵ {fmt(Math.abs(offer.balance))}</b></div>
      <div class="dim sm">₵ {fmt(trade.credits)} → ₵ {fmt(trade.credits - offer.balance)} · {Math.max(1, offerTrips)} shuttle {offerTrips > 1 ? 'trips' : 'trip'}</div>
    </div>
    <div class="btns">
      <button class="btn no" data-testid="trade-withdraw" onclick={() => api.dispatch({ type: 'trade.cancel', id: offer.id })}>WITHDRAW</button>
      <button class="btn go" data-testid="trade-accept" onclick={() => api.dispatch({ type: 'trade.accept', offer: offer.id })}>ACCEPT</button>
    </div>
  {:else}
    <div class="body" data-testid="trade-summary">
      {#each s.buy as l (l.item)}
        <div class="sl"><ItemIcon {api} item={l.item} size={22} /><span><span class="dim">Buy</span> {l.count} {l.name.toLowerCase()}</span><span class="gold"><span class="bad">−</span> ₵ {fmt(l.value)}</span></div>
      {/each}
      {#each s.sell as l (l.item)}
        <div class="sl"><ItemIcon {api} item={l.item} size={22} /><span><span class="dim">Sell</span> {l.count} {l.name.toLowerCase()}</span><span class="gold"><span class="good">+</span> ₵ {fmt(l.value)}</span></div>
      {/each}
      {#if empty}<div class="dim sm">Nothing picked yet. Use the − and + beside an item.</div>{/if}
      {#if !empty}
        <div class="tot" data-testid="trade-balance"><b>{s.balance > 0 ? 'You pay' : s.balance < 0 ? 'You get' : 'Even trade'}</b><b class="gold">₵ {fmt(Math.abs(s.balance))}</b></div>
        <div class="dim sm">₵ {fmt(trade.credits)} → ₵ {fmt(trade.credits - s.balance)} · {trips} shuttle {trips === 1 ? 'trip' : 'trips'}</div>
        {#if problem}<div class="warn sm" data-testid="trade-problem">{problem}</div>{/if}
      {/if}
    </div>
    <div class="btns">
      <button class="btn no" disabled={empty} data-testid="trade-clear" onclick={() => (draft = {})}>CLEAR</button>
      <button class="btn go" disabled={!!problem} title={problem} data-testid="trade-propose" onclick={propose}>PROPOSE</button>
    </div>
  {/if}
  {#if refuel}
    <div class="refuel" data-testid="refuel">
      <button class="btn act" data-testid="refuel-go" disabled={refuelOff} title={refuelTip} onclick={doRefuel}>{refuel.n > 0 ? `REFUEL · ${refuel.n} fuel · ₵ ${fmt(refuel.cost)}` : 'FUEL TANKS FULL'}</button>
    </div>
  {/if}
</div>

<style>
  .slip { display: flex; flex-direction: column; min-height: 0; overflow-y: auto; flex: 1 1 auto; }
  .sh { height: 34px; flex: none; display: flex; align-items: center; padding: 0 10px; background: var(--panel-2); border-bottom: 1px solid var(--line); font: 600 12px var(--head-font); letter-spacing: 0.14em; color: var(--dim); }
  .body { padding: 8px 10px; }
  .sl { display: grid; grid-template-columns: 22px 1fr auto; gap: 8px; align-items: center; padding: 3px 0; }
  .tot { display: flex; justify-content: space-between; border-top: 1px solid var(--line); margin-top: 6px; padding-top: 6px; }
  .gold { color: var(--gold); }
  .good { color: var(--green); }
  .bad { color: var(--red); }
  .warn { color: var(--amber); }
  .dim { color: var(--dim); }
  .sm { font-size: 12px; margin-top: 2px; }
  .btns { display: flex; gap: 8px; padding: 0 10px 10px; }
  .btn { flex: 1; min-width: 0; white-space: nowrap; font: 700 13px var(--head-font); letter-spacing: 0.08em; padding: 9px 6px; border: 1px solid var(--line-hi); background: transparent; color: var(--text); cursor: pointer; text-align: center; }
  .btn.go { flex: 1.4; border-color: var(--green); background: rgba(71, 224, 160, 0.1); color: var(--green); }
  .btn.no { border-color: var(--red); color: var(--red); }
  .btn.act { border-color: var(--cyan); color: var(--cyan); background: rgba(54, 212, 255, 0.07); }
  .btn:disabled { opacity: 0.45; cursor: default; }
  .btn.act:not(:disabled) { color: var(--cyan); border-color: var(--cyan); background: rgba(54, 212, 255, 0.12); }
  .refuel { padding: 0 10px 10px; display: flex; }
  .refuel .btn { flex: 1; font-size: 12px; padding: 6px 10px; }
</style>
