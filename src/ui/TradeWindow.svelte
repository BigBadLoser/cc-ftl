<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiTrade, UiTradeLine, UiTradePartner } from './api';
  import ItemIcon from './ItemIcon.svelte';

  let { api, partner: id, onClose }: { api: UiApi; partner: number; onClose: () => void } = $props();
  let trade = $state<UiTrade>({ credits: 0, partners: [], deals: [] });
  onMount(() => api.trade.subscribe((t) => (trade = t)));

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
  const pays = $derived(barter ? 0 : balance);
  const route = $derived(giveUnits > 0 ? p?.out : p?.in);

  const REASONS: Record<string, string> = {
    noCourier: 'No shuttle to carry it: fit one in a bay',
    courierBusy: 'Your shuttle is busy', noAirlock: 'No free working airlock to dock at', noShip: 'No ship',
  };
  const refusal: Record<string, string> = {
    hostile: 'They have no interest in talking to you.', weaponsHot: 'Their guns are on you: they will not talk.',
    silent: 'No answer. Nobody is aboard to hear.', noTrade: 'They have nothing to trade.',
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
    if (route && units > p.holdCap) return `Too much for one shuttle hold (${p.holdCap} units)`;
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
  const bal = (b: number, bt: boolean) => (bt || b === 0 ? 'Even trade, no credits' : b > 0 ? `You pay ${b} credits` : `They pay you ${-b} credits`);
</script>

<div class="veil" data-testid="trade-window">
  <div class="card" role="dialog" aria-modal="true" aria-label="Trade">
    <header>
      <div class="who">
        <h2 data-testid="trade-title">{p?.name ?? 'Trade'}</h2>
        <small>{p?.role ?? ''}{p && p.kind === 'ship' ? ` · ${p.distance} tiles away` : ''}</small>
      </div>
      <span class="chip" data-testid="trade-credits" title="Your credits">₵ {trade.credits}</span>
      <button aria-label="Close trade window" data-testid="trade-close" onclick={onClose}>×</button>
    </header>

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
              <span class="nm">{l.name}<small>{l.mine} held</small></span>
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
              <span class="nm">{l.name}<small>{l.theirs} in stock</small></span>
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
            <span>{deal.get ? `Receiving ${deal.get}` : ''}{deal.get && deal.give ? ', ' : ''}{deal.give ? `Sending ${deal.give}` : ''} · {bal(deal.balance, deal.barter)}</span>
            {#if deal.cancellable}<button data-testid="trade-cancel-deal" onclick={() => api.dispatch({ type: 'trade.cancel', id: deal.id })}>Call off</button>{/if}
          </div>
        {:else if p.offer}
          <div class="status" data-testid="trade-offer">
            <b>Offer: {fmt(p.offer.get)} for {fmt(p.offer.give)}</b>
            <span>{bal(p.offer.balance, p.offer.barter)} · {courierNote}</span>
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
          {#if !route?.error}<div class="note" data-testid="trade-courier">{courierNote}</div>{/if}
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
</div>

<style>
  .veil { position: fixed; inset: 0; z-index: 25; background: rgba(4, 8, 14, 0.5); display: grid; place-items: center; padding: 12px; touch-action: none; }
  .card { box-sizing: border-box; width: min(760px, 100%); max-height: calc(100dvh - 24px); overflow-y: auto; touch-action: pan-y; background: var(--panel-2); border: 1px solid var(--cyan); border-radius: 12px; padding: 14px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6); }
  header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .who { flex: 1; min-width: 0; }
  h2 { margin: 0; font-size: 18px; color: var(--cyan); }
  .who small { color: var(--dim); }
  .chip { padding: 5px 10px; border-radius: 8px; background: var(--bg); border: 1px solid var(--line); color: var(--amber); white-space: nowrap; }
  header button { min-width: 36px; min-height: 36px; padding: 0; font-size: 18px; }
  .greet { margin: 4px 0 8px; font-style: italic; }
  .greet small { color: var(--dim); font-style: normal; margin-left: 6px; }
  .msg { color: var(--dim); margin: 8px 0; }
  .msg.refused { color: #ff9a9a; }
  .tabs { display: none; gap: 6px; margin-bottom: 6px; }
  .tabs button { flex: 1; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .col { background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 8px; min-height: 120px; max-height: 330px; overflow-y: auto; }
  h3 { margin: 0 0 6px; font-size: 13px; color: var(--cyan); }
  h3 small { color: var(--dim); font-weight: normal; margin-left: 4px; }
  .row { display: flex; align-items: center; gap: 8px; padding: 3px 4px; border-radius: 6px; }
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
  @media (max-width: 600px) {
    .veil { place-items: end stretch; padding: 0; }
    .card { width: 100%; max-height: 88dvh; border-radius: 16px 16px 0 0; border-width: 1px 0 0; padding: 12px 12px calc(12px + var(--sab)); }
    .tabs { display: flex; }
    .cols { grid-template-columns: 1fr; }
    .col.hide { display: none; }
    .col { max-height: 34dvh; }
  }
</style>
