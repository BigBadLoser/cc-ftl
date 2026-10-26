<script lang="ts">
  import type { UiApi, UiJob, UiJobs, UiStrength } from './api';
  import Icon from './Icon.svelte';

  /** The job cards of the board: `active` the jobs the player holds, `offers` the work posted at the node. */
  let { api, jobs, list }: { api: UiApi; jobs: UiJobs; list: 'active' | 'offers' } = $props();
  const full = $derived(jobs.active.length >= jobs.max);
  const far = (j: UiJob): string => (j.here ? 'here' : j.hops === null ? 'out of range' : `${j.hops} jump${j.hops === 1 ? '' : 's'}`);
  const turns = (j: UiJob): string => `${j.turnsLeft} turn${j.turnsLeft === 1 ? '' : 's'} left`;
  const VERDICT = { outmatched: 'Outmatched', even: 'Even match', weaker: 'Weaker than you' } as const;
  const ROWS: { key: keyof UiStrength; label: string }[] = [
    { key: 'guns', label: 'Guns' }, { key: 'shields', label: 'Shields' }, { key: 'hull', label: 'Hull' },
  ];
</script>

{#snippet head(j: UiJob)}
  <div class="t"><b>{j.title}</b><span class="pay">{j.reward} cr</span></div>
  <div class="sub">{j.detail}</div>
  <dl class="facts">
    <div><dt><Icon name="map" size={13} title="Where" /></dt><dd>{j.where}</dd></div>
    <div><dt><Icon name="ship" size={13} title="Distance" /></dt><dd>{far(j)}</dd></div>
    <div><dt><Icon name="clock" size={13} title="Time left" /></dt><dd>{turns(j)}</dd></div>
    <div><dt><Icon name="flag" size={13} title="Client" /></dt><dd>{j.issuer}</dd></div>
  </dl>
{/snippet}

{#snippet strength(j: UiJob)}
  {#if j.target}
    {@const t = j.target}
    <div class="str" data-testid="job-strength">
      <table>
        <thead><tr><th></th><th>Target</th>{#if jobs.mine}<th>You</th>{/if}</tr></thead>
        <tbody>
          {#each ROWS as r (r.key)}
            <tr><th>{r.label}</th><td>{t.strength[r.key]}</td>{#if jobs.mine}<td>{jobs.mine[r.key]}</td>{/if}</tr>
          {/each}
        </tbody>
      </table>
      {#if t.read}<span class="badge {t.read}">{VERDICT[t.read]}</span>{/if}
    </div>
  {/if}
{/snippet}

<ul>
  {#if list === 'active'}
    {#each jobs.active as j (j.key)}
      <li class:due={j.turnsLeft <= 3} data-testid="job-active">
        {@render head(j)}
        {@render strength(j)}
        {#if j.kind === 'delivery' && !j.ready}<div class="warn">The crate is no longer aboard.</div>{/if}
        <div class="act">
          <button class="ghost" data-testid="job-abandon" onclick={() => j.id !== null && api.dispatch({ type: 'jobs.abandon', id: j.id })}>Abandon</button>
        </div>
      </li>
    {/each}
  {:else}
    {#each jobs.offers as j (j.key)}
      <li data-testid="job-offer">
        {@render head(j)}
        {@render strength(j)}
        <div class="act">
          <button data-testid="job-accept" disabled={full} title={full ? `You hold ${jobs.max} jobs already` : ''} onclick={() => api.dispatch({ type: 'jobs.accept', key: j.key })}>Accept</button>
        </div>
      </li>
    {/each}
  {/if}
</ul>

<style>
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  li { display: grid; gap: 8px; padding: 10px; background: var(--panel-2); border: 1px solid var(--line); }
  li.due { border-color: #ffb43c; }
  .t { display: flex; justify-content: space-between; gap: 8px; }
  .t b { color: var(--text); font-weight: 600; }
  .pay { color: #ffd77a; font-weight: 600; white-space: nowrap; }
  .sub { color: var(--dim); font-size: 12px; margin-top: -6px; }
  .facts { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 12px; font-size: 12px; }
  .facts > div { display: flex; align-items: center; gap: 6px; min-width: 0; }
  dt { display: flex; color: var(--dim); }
  dd { margin: 0; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .str { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 8px; background: rgba(0, 0, 0, 0.18); border: 1px solid var(--line); }
  table { border-collapse: collapse; font-size: 12px; }
  th, td { padding: 1px 12px 1px 0; text-align: right; font-variant-numeric: tabular-nums; color: var(--text); }
  thead th { color: var(--dim); font-weight: 500; }
  tbody th { text-align: left; color: var(--dim); font-weight: 500; }
  .badge { font-size: 12px; font-weight: 600; padding: 3px 8px; border: 1px solid currentColor; white-space: nowrap; }
  .badge.outmatched { color: var(--red); }
  .badge.even { color: var(--dim); }
  .badge.weaker { color: #7fd18b; }
  .warn { color: var(--red); font-size: 12px; }
  .act { display: flex; justify-content: flex-end; }
  li button { min-height: 30px; padding: 0 12px; }
</style>
