<script lang="ts">
  import type { UiApi, UiSalvage, UiScrapType } from './api';
  import InspectorAction from './InspectorAction.svelte';

  /** A derelict's salvage order: tick the scrap types to strip, then Salvage; while it runs, progress and Cancel (DESIGN.md "Salvaging derelicts"). */
  let { api, ship, salvage }: { api: UiApi; ship: number; salvage: UiSalvage } = $props();
  const LABEL: Record<UiScrapType, string> = { hull: 'Hull', tech: 'Tech', energy: 'Energy', weapons: 'Weapons', comfort: 'Comfort' };
  let ticked = $state<UiScrapType[]>([]);
  const order = $derived(salvage.order);
  // Types with nothing left cannot stay ticked.
  const live = $derived(order ? order.types : ticked.filter((t) => (salvage.types.find((x) => x.type === t)?.parts ?? 0) > 0));
  const pct = $derived(order && order.total > 0 ? Math.round((order.done / order.total) * 100) : 0);
  const message = $derived(!order ? 'Tick what to strip' : order.status === 'blocked' ? `Blocked: ${order.block}` : `Stripping… ${order.done} of ${order.total} parts`);
  const tip = (m: { name: string; count: number }[]) => (m.length ? `Est. yield: about ${m.map((q) => `${q.count} ${q.name}`).join(', ')}` : 'Est. yield: next to nothing');
  const toggle = (t: UiScrapType, on: boolean) => (ticked = on ? [...ticked, t] : ticked.filter((x) => x !== t));
  const buttons = $derived(
    order
      ? [{ label: 'Cancel salvage', testid: 'salvage-cancel', danger: true, onclick: () => api.dispatch({ type: 'salvage.cancel', ship }) }]
      : [{ label: 'Salvage', testid: 'salvage-go', commit: true, disabled: live.length === 0, title: 'Crew strip the ticked parts, in spacesuits', onclick: () => api.dispatch({ type: 'salvage.order', ship, types: [...live] }) }],
  );
</script>

<InspectorAction {message} alert={order?.status === 'blocked'} {buttons} testid="salvage-panel" resetKey={ship}>
  {#if order?.status === 'running'}
    <div class="bar" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100"><i style:width="{pct}%"></i></div>
  {/if}
  <div class="rows">
    {#each salvage.types as t (t.type)}
      {@const empty = t.parts === 0}
      <label class="row" class:off={!!order || empty} title={empty ? '' : tip(t.materials)} data-testid="salvage-{t.type}">
        <input type="checkbox" checked={live.includes(t.type)} disabled={!!order || empty} onchange={(e) => toggle(t.type, e.currentTarget.checked)} />
        <span class="n">{LABEL[t.type]}</span>
        <span class="c">{t.parts} {t.parts === 1 ? 'part' : 'parts'}</span>
      </label>
    {/each}
  </div>
  {#snippet footer()}
    <p class="eva" title="EVA work: crew need suits. Refill at the shuttle or an intact airlock.">EVA work, needs suits (refill at the shuttle or an airlock)</p>
  {/snippet}
</InspectorAction>

<style>
  .bar { height: 6px; background: var(--panel-3); }
  .bar i { display: block; height: 100%; background: var(--cyan); }
  .rows { display: grid; gap: 1px; }
  .row { display: flex; align-items: center; gap: 8px; padding: 3px 2px; font-size: 13px; cursor: pointer; }
  .row:hover { background: var(--panel-3); }
  .row .n { flex: 1; }
  .row .c { color: var(--dim); font-size: 12px; }
  .row.off { color: var(--dim); cursor: default; }
  .row.off:hover { background: none; }
  input[type='checkbox'] { accent-color: var(--cyan); margin: 0; }
  .eva { margin: 0; font-size: 11px; color: var(--dim); }
</style>
