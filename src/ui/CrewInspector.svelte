<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCrew } from './api';

  let { api, onPriorities }: { api: UiApi; onPriorities: () => void } = $props();
  let crew = $state<UiCrew[]>([]);
  let sel = $state<number | null>(null);
  const c = $derived(crew.find((x) => x.id === sel));

  onMount(() => {
    const a = api.crew.subscribe((v) => (crew = v));
    const b = api.selectedCrew.subscribe((s) => (sel = s));
    return () => (a(), b());
  });
</script>

{#if c}
  <aside class="sheet" data-testid="crew-inspector">
    <h2>{c.name} <small>{c.role}</small></h2>
    <dl>
      <dt>Activity</dt><dd data-testid="crew-activity">{c.drafted ? 'drafted' : c.activity}</dd>
      <dt>Job</dt><dd>{c.job ?? 'none'}</dd>
      <dt>Health</dt><dd data-testid="crew-health">{c.dead ? 'dead' : `${c.hp}/${c.maxHp}`}</dd>
      {#if c.downed}<dt>Bleeding out</dt><dd data-testid="crew-bleed" class="bad">{c.downed.stabilized ? 'stabilized' : `${c.downed.bleed}s`}</dd>{/if}
      {#if c.carriedBy}<dt>Carried by</dt><dd>{c.carriedBy}</dd>{/if}
      {#if c.carrying}<dt>Carrying</dt><dd>{c.carrying.count} {c.carrying.item.replace('item.', '')}</dd>{/if}
      <dt>Rest</dt><dd>{c.rest}%</dd>
    </dl>
    <div class="bar hp" class:low={c.hp / c.maxHp < 0.4}><i style:width="{Math.round((c.hp / c.maxHp) * 100)}%"></i></div>
    <div class="bar rest"><i style:width="{c.rest}%"></i></div>
    <div class="btns">
      <button class:on={c.drafted} data-testid="draft" onclick={() => api.dispatch({ type: 'crew.draft', id: c.id, drafted: !c.drafted })}>
        {c.drafted ? 'Undraft' : 'Draft'} (R)
      </button>
      <button data-testid="open-priorities" onclick={onPriorities}>Priorities</button>
    </div>
    {#if c.drafted}<p class="hint">Tap a floor tile to move.</p>{/if}
  </aside>
{/if}

<style>
  .bad { color: #ff9a9a; }
  .hp > i { background: #4cd964; } .hp.low > i { background: #ff5a2d; }
  .rest { margin-top: 4px; }
  aside { left: calc(8px + var(--sal)); bottom: calc(8px + var(--sab)); width: 260px; }
  h2 { margin: 0 0 6px; font-size: 15px; color: var(--cyan); }
  h2 small { color: var(--dim); font-weight: normal; margin-left: 6px; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; margin: 0 0 6px; }
  dt { color: var(--dim); } dd { margin: 0; text-align: right; text-transform: capitalize; }
  .btns { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 10px; }
  .hint { margin: 6px 0 0; color: var(--dim); font-size: 12px; }
  @media (max-width: 600px) { aside { width: auto; left: 0; bottom: 0; } }
</style>
