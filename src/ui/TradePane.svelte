<script lang="ts">
  import type { UiApi, UiTrade, UiTradeLine, UiTradePartner } from './api';
  import ItemIcon from './ItemIcon.svelte';
  import Icon from './Icon.svelte';

  let { api, partner: id, trade, compact = false }: { api: UiApi; partner: number; trade: UiTrade; compact?: boolean } = $props();

  const p = $derived<UiTradePartner | undefined>(trade.partners.find((x) => x.id === id));
  const deal = $derived(trade.deals.find((d) => d.ship === id && d.live));
  const last = $derived(!deal ? [...trade.deals].reverse().find((d) => d.ship === id) : undefined);

  // The draft: quantities the player wants to hand over (give) and receive (get), by item id.
  let give = $state<Record<string, number>>({});
  let get = $state<Record<string, number>>({});
  let barter = $state(false);
  let tab = $state<'mine' | 'theirs'>('theirs');

  const lines = $derived(p?.lines ?? []);
  const lineOf = (item: string): UiTradeLine | undefined => lines.find((l) => l.item === item);
  const sum = (q: Record<string, number>, price: (l: UiTradeLine) => number): number =>
    Object.entries(q).reduce((n, [item, c]) => n + c * (lineOf(item) ? price(lineOf(item) as UiTradeLine) : 0), 0);
  const getValue = $derived(sum(get, (l) => l.sell));
  const giveValue = $derived(sum(give, (l) => l.buy));
  const balance = $derived(getValue - giveValue);
  const giveUnits = $derived(Object.values(give).reduce((a, b) => a + b, 0));
  const getUnits = $derived(Object.values(get).reduce((a, b) => a + b, 0));
  const units = $derived(Math.max(giveUnits, getUnits));
  /** Trips the standing offer will take, with the hold they are sized by. */
  const offerTrips = $derived.by(() => {
    const o = p?.offer;
    const r = o && (o.give.length > 0 ? p?.out : p?.in);
    if (!o || !r || r.cap <= 0) return 0;
    const n = Math.max(o.give.reduce((a, l) => a + l.count, 0), o.get.reduce((a, l) => a + l.count, 0));
    return Math.ceil(n / r.cap);
  });
  const pays = $derived(barter ? 0 : balance);
  const route = $derived(giveUnits > 0 ? p?.out : p?.in);
  /** An order bigger than one hold runs as several trips, in turn. */
  const trips = $derived(route && route.cap > 0 ? Math.max(1, Math.ceil(units / route.cap)) : 1);
  const MAX_TRIPS = 8;

  const REASONS: Record<string, string> = {
    noCourier: 'No shuttle to carry it: fit one in a bay',
    courierBusy: 'Your shuttle is busy', noAirlock: 'No free working airlock to dock at', noShip: 'No ship',
  };
  const refusal: Record<string, string> = {
    hostile: 'They have no interest in talking to you.', weaponsHot: 'Their guns are on you: they will not talk.',
    silent: 'No answer. Nobody is aboard to hear.', noTrade: 'They have nothing to trade.',
    rule: 'They do not deal with outsiders. Earn their standing first.',
  };
  const courierNote = $derived(
    !route ? '' : route.error ? (REASONS[route.error] ?? route.error)
      : route.courier === 'them' ? 'Their shuttle flies it to your airlock.'
        : 'Your shuttle carries the goods and docks at your airlock.',
  );
  const problem = $derived.by(() => {
    if (!p) return '';
    if (units === 0) return 'Pick something to trade';
    if (barter && balance > 0) return `Short by ${balance} credits worth: add more from your side`;
    if (pays > trade.credits) return 'Not enough credits';
    if (pays < 0 && -pays > p.wallet) return 'They cannot afford to pay that';
    if (route?.error) return courierNote;
    if (route && trips > MAX_TRIPS) return `Too much: at most ${MAX_TRIPS} trips of ${route.cap} units`;
    return '';
  });

  function bump(side: 'give' | 'get', l: UiTradeLine, d: number) {
    const q = side === 'give' ? give : get;
    const max = side === 'give' ? l.mine : l.theirs;
    const n = Math.max(0, Math.min(max, (q[l.item] ?? 0) + d));
    if (side === 'give') give = { ...give, [l.item]: n };
    else get = { ...get, [l.item]: n };
  }
  const toLines = (q: Record<string, number>) => Object.entries(q).filter(([, c]) => c > 0).map(([item, count]) => ({ item, count }));
  function propose() {
    api.dispatch({ type: 'trade.offer', ship: id, give: toLines(give), get: toLines(get), barter });
  }
  const itemName = (item: string) => lineOf(item)?.name ?? api.items.find((i) => i.id === item)?.name ?? item;
  const fmt = (lines: { item: string; count: number }[]) => lines.map((l) => `${l.count} ${itemName(l.item)}`).join(', ') || 'nothing';
  function reset() {
    give = {};
    get = {};
    barter = false;
  }
  $effect(() => {
    // A deal that just started clears the draft.
    if (deal) reset();
  });
  // Refuel: one click buys fuel up to REFUEL_TARGET units aboard (or what the shelf holds) through the normal offer, and accepts it when it appears.
  const REFUEL_TARGET = 24;
  const FUEL = 'item.fuel';
  const fuelLine = $derived(p?.station && p.info?.services.includes('Fuel') ? lineOf(FUEL) : undefined);
  const refuel = $derived.by(() => {
    if (!fuelLine || fuelLine.theirs <= 0) return null;
    const n = Math.min(fuelLine.theirs, Math.max(0, REFUEL_TARGET - fuelLine.mine));
    return { n, cost: n * fuelLine.sell };
  });
  let refuelling = $state(false);
  function doRefuel() {
    if (!refuel || refuel.n <= 0) return;
    refuelling = true;
    api.dispatch({ type: 'trade.offer', ship: id, give: [], get: [{ item: FUEL, count: refuel.n }], barter: false });
  }
  $effect(() => {
    // The refuel offer has appeared: accept it. Anything else on the table is left alone.
    const o = p?.offer;
    if (refuelling && o) {
      refuelling = false;
      if (o.get.length === 1 && o.get[0]?.item === FUEL && o.give.length === 0) api.dispatch({ type: 'trade.accept', offer: o.id });
    }
  });
  const bal = (b: number, bt: boolean) => (bt || b === 0 ? 'Even trade, no credits' : b > 0 ? `You pay ${b} credits` : `They pay you ${-b} credits`);
</script>

<div class="pane" class:compact data-testid="trade-pane">
{#if !p}
  <p class="msg">They are gone.</p>
{:else if p.hail === 'none'}
  <p class="msg">No contact yet.</p>
  <button data-testid="trade-hail" onclick={() => api.dispatch({ type: 'trade.hail', ship: id })}>Hail {p.name}</button>
{:else if p.hail === 'refused'}
  <p class="msg refused" data-testid="trade-refused">{refusal[p.reason] ?? 'They refuse to talk.'}</p>
  <button data-testid="trade-rehail" onclick={() => api.dispatch({ type: 'trade.hail', ship: id })}>Hail again</button>
{:else}
  <p class="greet" data-testid="trade-answered">"{p.name} here, go ahead." <small>Their purse: ₵ {p.wallet}{p.rep ? ` · standing ${p.rep > 0 ? '+' : ''}${p.rep}` : ''}</small></p>
  {#if p.market}
    <div class="market" class:bad={p.market.banned} data-testid="black-market">
      <b>{p.market.names.join(' · ')}</b>
      <span data-testid="market-contraband">Contraband bought at {Math.round(p.market.contrabandRate * 100)}% of its value.{p.market.fence !== null ? ` The fence takes anything at ${Math.round(p.market.fence * 100)}%, no questions.` : ''}</span>
      {#if p.market.truce}<span data-testid="market-truce">{p.market.banned ? 'Truce broken: everyone here fires on you until the ban ends.' : 'Truce: nobody starts a fight here. Firing on or boarding anyone breaks it.'}</span>{/if}
    </div>
  {/if}
  {#if refuel}
    <div class="refuel" data-testid="refuel">
      <button class="go" data-testid="refuel-go" disabled={refuel.n <= 0 || refuel.cost > trade.credits || !!deal || !!p.offer || !!p.in.error}
        title={refuel.n <= 0 ? 'Tanks are full enough' : refuel.cost > trade.credits ? 'Not enough credits' : p.in.error ? (REASONS[p.in.error] ?? p.in.error) : ''} onclick={doRefuel}>
        {refuel.n > 0 ? `Refuel: ${refuel.n} fuel for ₵${refuel.cost}` : 'Fuel tanks full'}
      </button>
      <small>You hold {fuelLine?.mine ?? 0}. The shuttle brings it over.</small>
    </div>
  {/if}
  <div class="tabs">
    <button class:on={tab === 'mine'} onclick={() => (tab = 'mine')}>You give ({giveUnits})</button>
    <button class:on={tab === 'theirs'} onclick={() => (tab = 'theirs')}>You get ({getUnits})</button>
  </div>
  <div class="cols">
    <section class="col" class:hide={tab !== 'mine'} data-testid="trade-mine">
      <h3>Yours <small>they pay</small></h3>
      {#each lines.filter((l) => l.mine > 0) as l (l.item)}
        <div class="row" class:set={(give[l.item] ?? 0) > 0}>
          <ItemIcon {api} item={l.item} size={26} />
          <span class="nm">{l.name}<small>{l.mine} held{l.contraband ? ' · contraband' : ''}</small></span>
          <span class="pr">₵{l.buy}</span>
          <span class="step">
            <button aria-label="Fewer {l.name}" disabled={!!p.offer || (give[l.item] ?? 0) === 0} onclick={() => bump('give', l, -1)}>−</button>
            <b data-testid="give-{l.item}">{give[l.item] ?? 0}</b>
            <button aria-label="More {l.name}" data-testid="give-more-{l.item}" disabled={!!p.offer || (give[l.item] ?? 0) >= l.mine} onclick={() => bump('give', l, 1)}>+</button>
          </span>
        </div>
      {:else}
        <p class="none">Nothing in storage they would buy.</p>
      {/each}
    </section>
    <section class="col" class:hide={tab !== 'theirs'} data-testid="trade-theirs">
      <h3>Theirs <small>you pay</small></h3>
      {#each lines.filter((l) => l.theirs > 0) as l (l.item)}
        <div class="row" class:set={(get[l.item] ?? 0) > 0}>
          <ItemIcon {api} item={l.item} size={26} />
          <span class="nm">{l.name}<small>{l.theirs} in stock{l.surplus ? ' · surplus' : ''}{l.contraband ? ' · contraband' : ''}</small></span>
          <span class="pr">₵{l.sell}</span>
          <span class="step">
            <button aria-label="Fewer {l.name}" disabled={!!p.offer || (get[l.item] ?? 0) === 0} onclick={() => bump('get', l, -1)}>−</button>
            <b data-testid="get-{l.item}">{get[l.item] ?? 0}</b>
            <button aria-label="More {l.name}" data-testid="get-more-{l.item}" disabled={!!p.offer || (get[l.item] ?? 0) >= l.theirs} onclick={() => bump('get', l, 1)}>+</button>
          </span>
        </div>
      {:else}
        <p class="none">Their hold is empty.</p>
      {/each}
    </section>
  </div>

  <footer>
    {#if deal}
      <div class="status" data-testid="trade-status">
        <b>{deal.status}</b>
        {#if deal.trip}<span class="trip" data-testid="trade-trip"><Icon name="shuttle" size={12} /> Trip {deal.trip.n} of {deal.trip.of}{deal.trip.stopped ? ' (stopped early)' : ''}</span>{/if}
        <span>{deal.get ? `Receiving ${deal.get}` : ''}{deal.get && deal.give ? ', ' : ''}{deal.give ? `Sending ${deal.give}` : ''} · {bal(deal.balance, deal.barter)}</span>
        {#if deal.cancellable}<button data-testid="trade-cancel-deal" onclick={() => api.dispatch({ type: 'trade.cancel', id: deal.id })}>Call off</button>{/if}
      </div>
    {:else if p.offer}
      <div class="status" data-testid="trade-offer">
        <b>Offer: {fmt(p.offer.get)} for {fmt(p.offer.give)}</b>
        <span>{bal(p.offer.balance, p.offer.barter)} · {courierNote}{offerTrips > 1 ? ` ${offerTrips} trips, one after another.` : ''}</span>
        <div class="btns">
          <button class="go" data-testid="trade-accept" onclick={() => p.offer && api.dispatch({ type: 'trade.accept', offer: p.offer.id })}>Accept deal</button>
          <button data-testid="trade-withdraw" onclick={() => p.offer && api.dispatch({ type: 'trade.cancel', id: p.offer.id })}>Withdraw</button>
        </div>
      </div>
    {:else}
      <div class="sum" data-testid="trade-summary">
        <span>Buying <b>₵{getValue}</b></span>
        <span>Selling <b>₵{giveValue}</b></span>
        <span class="bal" class:bad={barter && balance > 0} data-testid="trade-balance">{bal(balance, barter)}{barter && balance > 0 ? ` (short ${balance})` : ''}</span>
      </div>
      <label class="barter"><input type="checkbox" bind:checked={barter} data-testid="trade-barter" /> Barter: items for items, no credits</label>
      {#if !route?.error}<div class="note" data-testid="trade-courier">{courierNote}{trips > 1 ? ` ${units} units: ${trips} trips of up to ${route?.cap}, one after another.` : ''}</div>{/if}
      <div class="btns">
        <button class="go" disabled={!!problem} data-testid="trade-propose" title={problem} onclick={propose}>Propose</button>
        <button onclick={reset}>Clear</button>
      </div>
      {#if problem && units > 0}<div class="note bad" data-testid="trade-problem">{problem}</div>{/if}
      {#if last}<div class="note" data-testid="trade-last">Last deal: {last.status}</div>{/if}
    {/if}
  </footer>
{/if}
</div>

<style>
  /* A column: everything stays put except the item lists, which take the spare height and scroll. */
  .pane { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }
  .pane > :not(.cols) { flex: none; }
  .greet { margin: 4px 0 8px; font-style: italic; }
  .greet small { color: var(--dim); font-style: normal; margin-left: 6px; }
  .msg { color: var(--dim); margin: 8px 0; }
  .msg.refused { color: #ff9a9a; }
  .market { display: grid; gap: 2px; margin-bottom: 8px; padding: 6px 8px; background: var(--bg); border: 1px solid var(--amber); font-size: 12px; }
  .market b { color: var(--amber); font-size: 13px; }
  .market span { color: var(--dim); }
  .market.bad { border-color: var(--red); }
  .market.bad span:last-child { color: #ff9a9a; }
  .refuel { display: grid; gap: 2px; margin-bottom: 8px; }
  .refuel .go { background: #0e4a56; border-color: var(--cyan); min-height: 36px; }
  .refuel small { color: var(--dim); font-size: 11px; }
  .tabs { display: none; gap: 6px; margin-bottom: 6px; }
  .tabs button { flex: 1; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: minmax(0, 1fr); gap: 10px; flex: 1 1 auto; min-height: 0; }
  .col { background: var(--bg); border: 1px solid var(--line); border-radius: 0; padding: 8px; min-height: 0; overflow-y: auto; }
  h3 { margin: 0 0 6px; font-size: 13px; color: var(--cyan); }
  h3 small { color: var(--dim); font-weight: normal; margin-left: 4px; }
  .row { display: flex; align-items: center; gap: 8px; padding: 3px 4px; border-radius: 0; }
  .row.set { background: #0e2a36; }
  .nm { flex: 1; min-width: 0; display: grid; line-height: 1.15; }
  .nm small { color: var(--dim); font-size: 11px; }
  .pr { color: var(--amber); min-width: 3em; text-align: right; }
  .step { display: inline-flex; align-items: center; gap: 4px; }
  .step button { min-width: 34px; min-height: 34px; padding: 0; font-size: 16px; }
  .step b { min-width: 2em; text-align: center; }
  .none { color: var(--dim); margin: 4px 0; }
  footer { margin-top: 10px; display: grid; gap: 6px; }
  .sum { display: flex; flex-wrap: wrap; gap: 4px 16px; align-items: baseline; }
  .sum b { color: var(--amber); }
  .bal { margin-left: auto; font-weight: 600; }
  .bal.bad, .note.bad { color: #ff9a9a; }
  .note { color: var(--dim); font-size: 12px; }
  .barter { font-size: 13px; display: flex; gap: 6px; align-items: center; }
  .btns { display: flex; gap: 8px; }
  .btns .go { background: #0e4a56; border-color: var(--cyan); flex: 1; }
  .status { display: grid; gap: 4px; }
  .status span { color: var(--dim); font-size: 13px; }
  .status .trip { display: inline-flex; align-items: center; gap: 4px; color: var(--cyan); }
  .compact .tabs { display: flex; }
  .compact .cols { grid-template-columns: 1fr; }
  .compact .col.hide { display: none; }
  @media (max-width: 600px) {
    .tabs { display: flex; }
    .cols { grid-template-columns: 1fr; }
    .col.hide { display: none; }
  }
</style>
