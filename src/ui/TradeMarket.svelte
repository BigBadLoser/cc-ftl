<script lang="ts">
  import { tip } from './kit';
  import type { UiApi, UiTradeLine, UiTradePartner } from './api';
  import ItemIcon from './ItemIcon.svelte';
  import { clampQty, limits, sellable, stepOf, type Draft } from './tradeDraft';

  /** The market list: one row per item, a signed −/+ picker per row (positive buys, negative sells). The draft is the parent's. */
  let { api, p, credits, draft = $bindable(), locked = false }: { api: UiApi; p: UiTradePartner; credits: number; draft: Draft; locked?: boolean } = $props();

  /** What the pickers show: the draft, or while an offer is pending the offer itself (locked), so the list and the slip agree. */
  const shown = $derived<Draft>(p.offer ? Object.fromEntries([...p.offer.get.map((l) => [l.item, l.count]), ...p.offer.give.map((l) => [l.item, -l.count])]) : draft);
  const set = (item: string, n: number) => (draft = { ...draft, [item]: n });
  const lim = (l: UiTradeLine) => limits(l, p, draft, credits);
  /** Click ±1, Shift ±5, Ctrl ±10, Alt the most there is. */
  function bump(e: MouseEvent, l: UiTradeLine, dir: 1 | -1) {
    const m = lim(l);
    const cur = draft[l.item] ?? 0;
    // From a buy of 5, a minus click walks it down through zero into selling.
    set(l.item, clampQty(e.altKey ? (dir > 0 ? m.cashUp : -m.cashDown) : cur + dir * stepOf(e), m));
  }
  function typed(e: Event, l: UiTradeLine) {
    const el = e.currentTarget as HTMLInputElement;
    const v = clampQty(parseInt(el.value.replace('−', '-'), 10), lim(l));
    set(l.item, v);
    el.value = fmt(v);
  }
  const fmt = (n: number) => (n > 0 ? `+${n}` : String(n));
  const dash = '—';
  // Rows: everything they stock or you hold.
  const rows = $derived(p.lines);
</script>

<div class="market" data-testid="trade-market">
  <div class="row hdr" role="row">
    <span></span><span>ITEM</span><span class="c">ABOARD</span><span class="c">THEY PAY</span><span class="c">STOCK</span><span class="c">PRICE</span><span class="c">SELL · BUY</span>
  </div>
  <div class="rows">
    {#each rows as l (l.item)}
      {@const q = shown[l.item] ?? 0}
      {@const m = lim(l)}
      <div class="row" class:set={q !== 0} data-testid="trade-row-{l.item}">
        <ItemIcon {api} item={l.item} size={28} />
        <span class="nm">{l.name}{#if l.surplus}<span class="chip good" use:tip={{ text: 'Older, middle-grade gear this depot sells off' }}>SURPLUS</span>{/if}{#if l.contraband}<span class="chip bad" use:tip={{ text: 'Contraband: only a black market takes it, and navy and corporation scans confiscate it' }}>CONTRABAND</span>{/if}</span>
        <span class="c" class:dim={l.mine === 0}>{l.mine > 0 ? l.mine : dash}</span>
        <span class="c" class:dim={!sellable(l, p)}>{#if sellable(l, p)}<span class="gold">₵ {l.buy}</span>{:else}{dash}{/if}</span>
        <span class="c" class:dim={l.theirs === 0}>{l.theirs > 0 ? l.theirs : dash}</span>
        <span class="c" class:dim={l.theirs === 0}>{#if l.theirs > 0}<span class="gold">₵ {l.sell}</span>{:else}{dash}{/if}</span>
        <div class="pick">
          <div class="step" class:z={q === 0}>
            <button aria-label="Sell more {l.name}" data-testid="trade-minus-{l.item}" disabled={locked || (q <= 0 && m.down === 0)} onclick={(e) => bump(e, l, -1)}>−</button>
            <input aria-label="Amount of {l.name}" data-testid="trade-qty-{l.item}" value={fmt(q) === '+0' ? '0' : fmt(q)} disabled={locked || (m.up === 0 && m.down === 0)} onchange={(e) => typed(e, l)} onfocus={(e) => (e.currentTarget as HTMLInputElement).select()} />
            <button aria-label="Buy more {l.name}" data-testid="trade-plus-{l.item}" disabled={locked || (q >= 0 && m.up === 0)} onclick={(e) => bump(e, l, 1)}>+</button>
          </div>
          <span class="st">{q > 0 ? 'BUYING' : q < 0 ? 'SELLING' : ''}</span>
        </div>
      </div>
    {:else}
      <p class="none">Nothing here to trade.</p>
    {/each}
  </div>
  <div class="hint">Click ±1 · <span class="kb">Shift</span> ±5 · <span class="kb">Ctrl</span> ±10 · type a number · <span class="kb">Alt</span> max</div>
</div>

<style>
  .market { display: flex; flex-direction: column; min-height: 0; min-width: 0; border-right: 1px solid var(--line); }
  .rows { overflow-y: auto; min-height: 0; flex: 1 1 auto; }
  .row { display: grid; grid-template-columns: 30px 168px 68px 68px 68px 68px 112px; column-gap: 16px; align-items: center; padding: 5px 10px; border-bottom: 1px solid var(--line); min-height: 44px; box-sizing: border-box; }
  .row.hdr { font: 600 11px var(--head-font); letter-spacing: 0.12em; color: var(--dim); background: var(--panel-2); height: 34px; min-height: 34px; padding-block: 0; }
  .row.set { background: #0f171c; }
  .c { text-align: center; }
  .dim { color: var(--dim); }
  .gold { color: var(--gold); }
  .nm { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-width: 0; }
  .chip { font: 600 10px var(--head-font); letter-spacing: 0.1em; padding: 0 5px; border: 1px solid var(--line-hi); color: var(--dim); }
  .chip.good { color: var(--green); border-color: #24443a; }
  .chip.bad { color: var(--red); border-color: #7a3228; }
  .pick { justify-self: end; display: flex; flex-direction: column; align-items: center; gap: 2px; width: 100px; }
  .step { display: flex; align-items: center; border: 1px solid var(--line-hi); }
  .step button { width: 24px; height: 24px; min-height: 0; min-width: 0; padding: 0; border: 0; background: transparent; color: var(--cyan); font-size: 15px; line-height: 1; cursor: pointer; }
  .step button:disabled { color: var(--dim); opacity: 0.4; cursor: default; }
  .step input { width: 40px; height: 24px; box-sizing: border-box; text-align: center; font: 600 13px inherit; border: 0; border-inline: 1px solid var(--line); background: transparent; color: var(--text); padding: 0; }
  .step.z input { color: var(--dim); }
  .st { font: 600 9.5px var(--head-font); letter-spacing: 0.1em; height: 11px; color: var(--dim); }
  .hint { padding: 6px 10px; font-size: 11px; color: var(--dim); margin-top: auto; }
  .kb { font: 600 10.5px inherit; border: 1px solid var(--line-hi); padding: 0 4px; }
  .none { color: var(--dim); padding: 10px; margin: 0; }
</style>
