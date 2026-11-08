<script lang="ts">
  import { tip } from './kit';
  import { onMount } from 'svelte';
  import type { UiApi, UiJobs } from './api';
  import Icon, { type IconName } from './Icon.svelte';
  import { trackerGroups, type TrackerRow } from './jobsTracker';
  import { readCollapsed, writeCollapsed } from './cardCollapse';

  /**
   * The accepted jobs, tracked under the goals card like a quest log, in two groups: what can be done in this node now
   * (a cyan band), then the rest nearest first. Each row: kind icon, title, what to do or where, turns left and pay; an amber
   * edge when time is short. Hidden with no jobs. A row opens the Jobs window.
   */
  let { api, onOpen }: { api: UiApi; onOpen: () => void } = $props();
  let jobs = $state<UiJobs>({ here: null, offers: [], active: [], handIn: [], asked: [], max: 0, mine: null });
  let collapsed = $state(readCollapsed('jobs'));
  function toggle() {
    collapsed = !collapsed;
    writeCollapsed('jobs', collapsed);
  }
  const groups = $derived(trackerGroups(jobs));
  const KIND_ICON: Record<TrackerRow['kind'], IconName> = { delivery: 'stock', bounty: 'target', survey: 'map', passage: 'person' };
  onMount(() => api.jobs.subscribe((v) => (jobs = v)));
</script>

{#snippet row(r: TrackerRow, here: boolean)}
  <li>
    <button class="row" class:here class:urgent={r.urgent} use:tip={{ text: r.full }} data-testid="jobs-tracker-row" onclick={onOpen}>
      <Icon name={KIND_ICON[r.kind]} size={13} />
      <span class="m"><b>{r.title}</b><span class="line" class:problem={r.problem}>{r.line}</span></span>
      <span class="n">
        <span class="turns" class:short={r.urgent} use:tip={{ text: 'Turns left' }}><Icon name="clock" size={12} />{r.turnsLeft}</span>
        <span class="pay">{r.reward} cr</span>
      </span>
    </button>
  </li>
{/snippet}

{#if jobs.active.length}
  <section class="card hud-fade" data-testid="jobs-tracker">
    <div class="head">
      <button class="title" onclick={toggle} aria-expanded={!collapsed} data-testid="jobs-tracker-toggle">
        <span class="act">Jobs {jobs.active.length}/{jobs.max}</span>
        <Icon name={collapsed ? 'chevDown' : 'chevUp'} size={16} />
      </button>
    </div>
    {#if !collapsed}
      <p class="grp">Here</p>
      {#if groups.here.length}<ul>{#each groups.here as r (r.key)}{@render row(r, true)}{/each}</ul>
      {:else}<p class="none">Nothing to do in this node</p>{/if}
      {#if groups.away.length}
        <p class="grp">Away</p>
        <ul>{#each groups.away as r (r.key)}{@render row(r, false)}{/each}</ul>
      {/if}
    {/if}
  </section>
{/if}

<style>
  .card { pointer-events: auto; }
  .head { display: flex; align-items: center; gap: 6px; margin: 0; }
  .title { flex: 1; display: flex; align-items: center; gap: 6px; min-height: 18px; padding: 0; border: 0; background: none; text-align: left; color: var(--text); }
  .act { font: 600 11px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-accent); white-space: nowrap; }
  .title :global(.icon) { margin-left: auto; color: var(--ink-accent); }
  .grp { display: flex; align-items: center; gap: 6px; margin: 4px 0 1px; font: 600 10px var(--head-font); letter-spacing: 0.1em; text-transform: uppercase; color: var(--dim); }
  .grp::after { content: ''; flex: 1; height: 1px; background: rgba(255, 255, 255, 0.08); }
  .none { margin: 0; padding: 1px 0 2px 25px; font-size: 11px; color: var(--dim); }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  .row { display: grid; grid-template-columns: 13px 1fr auto; align-items: start; gap: 0 6px; width: 100%; min-height: 0; padding: 2px 4px; border: 0; border-left: 2px solid transparent; background: none; text-align: left; font-size: 12px; }
  .row:hover { background: rgba(255, 255, 255, 0.05); }
  .row.here { background: rgba(54, 212, 255, 0.07); }
  .row.here:hover { background: rgba(54, 212, 255, 0.12); }
  .row.urgent { border-left-color: var(--amber); }
  .row > :global(.icon) { margin-top: 2px; color: var(--dim); }
  .m { display: grid; min-width: 0; }
  .m b { color: var(--text); font-weight: 600; overflow-wrap: anywhere; }
  .line { font-size: 11px; color: var(--dim); }
  .here .line { color: var(--cyan); }
  .line.problem, .here .line.problem { color: var(--amber); }
  .n { display: grid; justify-items: end; font-size: 11px; font-variant-numeric: tabular-nums; }
  .turns { display: flex; align-items: center; gap: 3px; color: var(--ink-accent); }
  .turns.short { color: var(--amber); }
  .pay { color: var(--gold); }
</style>
