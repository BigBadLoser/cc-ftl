<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiShuttles } from './api';
  import ItemIcon from './ItemIcon.svelte';
  import { NumberStepper, Select } from './kit';

  let { api }: { api: UiApi } = $props();
  let data = $state<UiShuttles>({ shuttles: [], airlocks: [], targets: [], roster: [], bays: [], regions: [], transfers: [], ferryReady: false });
  onMount(() => api.shuttles.subscribe((v) => (data = v)));

  let fromId = $state(0);
  let toId = $state(0);
  let picked = $state<Record<string, number>>({});
  const from = $derived(data.regions.find((r) => r.id === fromId) ?? data.regions[0]);
  const to = $derived(data.regions.find((r) => r.id === toId && r.id !== from?.id) ?? data.regions.find((r) => r.id !== from?.id));
  const lines = $derived((from?.stock ?? []).map((l) => ({ ...l, take: Math.min(picked[l.item] ?? 0, l.count) })));
  const chosen = $derived(lines.reduce((n, l) => n + l.take, 0));
  const regionOpts = (skip?: number) => data.regions.filter((r) => r.id !== skip).map((r) => ({ value: String(r.id), label: r.name, sub: r.home ? 'home' : undefined }));

  function send() {
    if (!from || !to || chosen === 0) return;
    api.dispatch({ type: 'transfer.order', from: from.id, to: to.id, items: lines.filter((l) => l.take > 0).map((l) => ({ item: l.item, count: l.take })) });
    picked = {};
  }
  const pct = (t: { moved: number; total: number }) => Math.round((t.moved / Math.max(1, t.total)) * 100);
</script>

<div class="ts" data-testid="transfer-section">
  {#if data.regions.length > 1 && from && to}
    <div class="route" data-testid="transfer-form">
      <Select label="From" testId="transfer-from" value={String(from.id)} onChange={(v) => { fromId = Number(v); picked = {}; }} options={regionOpts()} />
      <span class="arrow">to</span>
      <Select label="To" testId="transfer-to" value={String(to.id)} onChange={(v) => (toId = Number(v))} options={regionOpts(from.id)} />
    </div>
    <div class="scroll"><ul class="items">
      {#each lines as l (l.item)}
        <li data-testid="transfer-line-{l.item}">
          <span class="nm"><ItemIcon {api} item={l.item} size={26} />{l.name}</span>
          <small>{l.count}</small>
          <NumberStepper label="{l.name} to move" min={0} max={l.count} value={l.take} step={(v, d) => v + d * (v >= 20 ? 10 : v >= 5 ? 5 : 1)} onChange={(v) => (picked = { ...picked, [l.item]: v })}
            valueTestId="transfer-qty-{l.item}" incTestId="transfer-inc-{l.item}" decTestId="transfer-dec-{l.item}" />
        </li>
      {:else}
        <li class="none">Nothing stored at {from.name}.</li>
      {/each}
    </ul></div>
    <button class="go" disabled={chosen === 0} data-testid="transfer-send" onclick={send}>Transfer{chosen ? ` ${chosen}` : ''}</button>
    <p class="hint">A free shuttle and pilot take it over by themselves, in as many trips as it needs.</p>
  {:else}
    <p class="none">Claim a base to move goods between ships. Salvage from wrecks is brought home automatically.</p>
  {/if}

  <h3>Queue</h3>
  <div class="qscroll"><ul class="queue" data-testid="transfer-queue">
    {#each data.transfers as t (t.id)}
      <li data-testid="transfer-{t.id}" class:blocked={t.state === 'blocked'}>
        <div class="row1"><b>{t.from} to {t.to}</b>{#if t.auto}<small>salvage</small>{/if}
          <button class="mini" data-testid="transfer-cancel-{t.id}" onclick={() => api.dispatch({ type: 'transfer.cancel', order: t.id })}>Cancel</button></div>
        <div class="what">{t.items.map((l) => `${l.count} ${l.name}`).join(', ')}</div>
        <div class="bar"><i style:width="{pct(t)}%"></i></div>
        <div class="st" data-testid="transfer-status-{t.id}">{t.status}{t.moved ? ` · ${t.moved}/${t.total} delivered` : ''}</div>
      </li>
    {:else}
      <li class="none" data-testid="transfer-empty">No transfers.</li>
    {/each}
  </ul></div>
</div>

<style>
  .ts { display: flex; flex-direction: column; flex: 1; min-height: 0; }
  .route, .go, .hint, h3 { flex: none; }
  .scroll { flex: 1 1 0; min-height: 96px; overflow-y: auto; border: 1px solid var(--line); background: var(--panel-2); padding: 6px; }
  .qscroll { flex: 0 1 34%; min-height: 64px; overflow-y: auto; }
  .route { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 6px; align-items: center; margin-bottom: 8px; }
  .route :global(.kit-sel-trigger) { width: 100%; }
  .arrow, small, .hint { color: var(--dim); font-size: 12px; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  .items li { display: grid; grid-template-columns: 1fr 36px auto; align-items: center; gap: 6px; }
  .items small { text-align: right; }
  .nm { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .go { width: 100%; margin-top: 8px; }
  .hint { margin: 4px 0 0; }
  h3 { margin: 12px 0 4px; font-size: 13px; color: var(--ink-accent); }
  .queue li { border: 1px solid var(--line); background: var(--panel-2); padding: 6px 8px; display: grid; gap: 2px; }
  .queue li.blocked { border-color: var(--amber); }
  .row1 { display: flex; align-items: center; gap: 8px; }
  .row1 b { flex: 1; font-weight: 600; }
  .mini { min-height: 28px; min-width: 0; padding: 0 8px; font-size: 12px; }
  .what { font-size: 12px; }
  .bar { height: 4px; background: var(--panel-3); }
  .bar i { display: block; height: 100%; background: var(--cyan); }
  .st { font-size: 12px; color: var(--dim); }
  .blocked .st { color: var(--amber); }
  .none { color: var(--dim); margin: 4px 0; }
</style>
