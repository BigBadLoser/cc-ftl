<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCost, UiFab, UiOrder, UiRecipe } from './api';
  import ItemIcon from './ItemIcon.svelte';
  import { NumberStepper, Segmented } from './kit';

  let { api, id, def }: { api: UiApi; id: number; def: string } = $props();
  let fabs = $state<UiFab[]>([]);
  onMount(() => api.fabs.subscribe((v) => (fabs = v)));
  const fab = $derived(fabs.find((x) => x.id === id));
  const recipes = $derived(api.recipes.filter((r) => r.station === def));
  const recipeOf = (o: UiOrder): UiRecipe | undefined => api.recipes.find((r) => r.id === o.recipe);

  let picking = $state(false);
  let pick = $state<string | null>(null);
  let mode = $state<'count' | 'keep'>('count');
  let target = $state(5);
  const defaults = { count: 5, keep: 20 };
  function setMode(m: 'count' | 'keep') {
    mode = m;
    target = defaults[m];
  }
  /** Steps of 1, growing to 5 from 20 up; never below 1. */
  const step = (v: number, d: 1 | -1) => v + d * (v >= 20 ? 5 : 1);

  function add() {
    if (!pick) return;
    api.dispatch({ type: 'production.add', moduleId: id, recipe: pick, mode, target });
    pick = null;
    picking = false;
  }
  const edit = (i: number, patch: { mode?: 'count' | 'keep'; target?: number }) => api.dispatch({ type: 'production.edit', moduleId: id, index: i, ...patch });
  const move = (i: number, to: number) => api.dispatch({ type: 'production.reorder', moduleId: id, from: i, to });
  const remove = (i: number) => api.dispatch({ type: 'production.remove', moduleId: id, index: i });

  const phaseText = { materials: 'Waiting for materials', power: 'No power', crafting: 'Crafting', ready: 'Ready, waiting for crew' };
  const flow = (list: UiCost[]) => list.map((c) => `${c.count} ${c.name}`).join(' + ');
  const progress = (o: UiOrder) => (o.mode === 'count' ? `${o.done}/${o.target} batches` : `stock ${o.have}/${o.target}`);
  const finished = (o: UiOrder) => (o.mode === 'count' ? o.done >= o.target : o.have >= o.target);
</script>

{#if fab}
  <section data-testid="fab-panel">
    <div class="job" data-testid="fab-job">
      {#if fab.job}
        <div class="jl"><span>{fab.job.name}</span><b class:bad={fab.job.phase === 'power' || fab.job.phase === 'materials'}>{phaseText[fab.job.phase]}</b></div>
        <div class="bar prog"><i style:width="{Math.round(fab.job.progress * 100)}%"></i></div>
      {:else}
        <div class="jl"><span class="dim">{fab.orders.some((o) => !finished(o)) ? 'Starting next batch' : 'Idle: no open orders'}</span></div>
      {/if}
    </div>

    <h3>Orders <small>top to bottom</small></h3>
    <ol class="orders" data-testid="fab-orders">
      {#each fab.orders as o, i (i)}
        {@const r = recipeOf(o)}
        <li class:active={o.active} class:done={finished(o)} data-testid="order-{i}">
          <div class="l1">
            {#if r?.outputs[0]}<ItemIcon {api} item={r.outputs[0].item} size={28} />{/if}
            <span class="nm">{o.name}</span>
            <span class="pr">{o.active ? 'working: ' : finished(o) ? 'met: ' : ''}{progress(o)}</span>
          </div>
          {#if r}
            <div class="rf" data-testid="order-recipe-{i}">{flow(r.inputs)} → {flow(r.outputs)}
              {#if o.missing.length}<b class="bad" data-testid="order-missing-{i}">missing {o.missing.join(', ')}</b>{:else}<span class="ok">inputs in stock</span>{/if}
            </div>
          {/if}
          <div class="l2">
            <button class="mode" data-testid="order-mode-{i}" title="Make N batches, or keep stock at N" onclick={() => edit(i, { mode: o.mode === 'count' ? 'keep' : 'count' })}>{o.mode === 'count' ? 'Make' : 'Keep'}</button>
            <NumberStepper value={o.target} min={1} {step} label="Batches" decTestId="order-dec-{i}" incTestId="order-inc-{i}" onChange={(v) => edit(i, { target: v })} />
            <span class="mv">
              <button aria-label="Move up" disabled={i === 0} onclick={() => move(i, i - 1)}>↑</button>
              <button aria-label="Move down" disabled={i === fab.orders.length - 1} onclick={() => move(i, i + 1)}>↓</button>
              <button class="rm" aria-label="Remove order" data-testid="order-remove-{i}" onclick={() => remove(i)}>×</button>
            </span>
          </div>
        </li>
      {:else}
        <li class="none">No orders yet.</li>
      {/each}
    </ol>

    {#if picking}
      <div class="picker" data-testid="recipe-picker">
        {#each recipes as r (r.id)}
          <button class="rec" class:on={pick === r.id} data-testid="recipe-{r.id}" onclick={() => (pick = r.id)}>
            <ItemIcon {api} item={r.outputs[0]?.item ?? ''} size={30} />
            <span class="rt">
              <span class="rn">{r.name}</span>
              <span class="rf">{flow(r.inputs)} → {flow(r.outputs)}</span>
            </span>
            <span class="sec">{r.seconds.toFixed(1)}s</span>
          </button>
        {/each}
        {#if pick}
          <div class="form">
            <Segmented label="Order type" value={mode} onChange={(m) => setMode(m as 'count' | 'keep')} options={[{ value: 'count', label: 'Make', testId: 'add-mode-count' }, { value: 'keep', label: 'Keep', testId: 'add-mode-keep' }]} />
            <NumberStepper value={target} min={1} {step} label="Target" valueTestId="add-target" onChange={(v) => (target = v)} />
            <button class="go" data-testid="add-order" onclick={add}>Add</button>
          </div>
          <p class="hint">{mode === 'count' ? `Craft ${target} batch${target === 1 ? '' : 'es'}.` : `Keep ${target} in stock, crafting whenever it drops below.`}</p>
        {/if}
        <button class="cancel" onclick={() => ((picking = false), (pick = null))}>Cancel</button>
      </div>
    {:else}
      <button class="addbtn" data-testid="add-order-open" onclick={() => (picking = true)}>+ Add order</button>
    {/if}
  </section>
{/if}

<style>
  section { margin-top: 8px; }
  .jl { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
  .dim { color: var(--dim); }
  .bad { color: #ff9a9a; }
  .prog > i { background: #ff9a3c; }
  h3 { margin: 10px 0 4px; font-size: 13px; color: var(--cyan); }
  h3 small { color: var(--dim); font-weight: normal; margin-left: 6px; }
  .orders { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .orders li { background: #0e1626; border: 1px solid var(--line); border-radius: 0; padding: 4px 6px; }
  .orders li.active { border-color: #ff9a3c; }
  .orders li.done { opacity: 0.6; }
  .orders li.none { color: var(--dim); border-style: dashed; padding: 8px; }
  .orders .rf { color: var(--dim); font-size: 12px; margin-top: 2px; }
  .orders .rf b { margin-left: 6px; font-weight: 600; }
  .orders .rf .ok { margin-left: 6px; color: #7fd38a; }
  .l1 { display: flex; align-items: center; gap: 6px; }
  .nm { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pr { color: var(--dim); font-size: 12px; white-space: nowrap; }
  .l2 { display: flex; align-items: center; gap: 6px; margin-top: 2px; justify-content: space-between; }
  .l2 button, .form button, .picker .cancel { min-height: 36px; min-width: 36px; padding: 0 8px; }
  .mode { min-width: 56px; }
  .mv { display: flex; gap: 4px; }
  .rm { color: #ff9a9a; }
  .addbtn { margin-top: 8px; width: 100%; }
  .picker { margin-top: 8px; display: grid; gap: 4px; }
  .rec { display: flex; align-items: center; gap: 8px; text-align: left; padding: 2px 8px 2px 4px; min-height: 44px; }
  .rt { flex: 1; display: grid; line-height: 1.2; min-width: 0; }
  .rn { font-weight: 600; }
  .rf { color: var(--dim); font-size: 12px; }
  .sec { color: var(--cyan); font-size: 12px; }
  .form { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 4px; }
  .go { background: #0e4a56; border-color: var(--cyan); min-width: 64px; }
  .hint { margin: 2px 0 0; color: var(--dim); font-size: 12px; }
</style>
