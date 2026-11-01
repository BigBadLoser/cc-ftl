<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiJobs } from './api';
  import Icon from './Icon.svelte';
  import { trackerRows } from './jobsTracker';
  import { readCollapsed, writeCollapsed } from './cardCollapse';

  /**
   * The accepted jobs, tracked under the goals card like a quest log: one row each with its key fact and state. Hidden with no jobs.
   * A row opens the Jobs window. Desktop only: no phone variant.
   */
  let { api, onOpen }: { api: UiApi; onOpen: () => void } = $props();
  let jobs = $state<UiJobs>({ here: null, offers: [], active: [], handIn: [], max: 0, mine: null });
  let collapsed = $state(readCollapsed('jobs'));
  function toggle() {
    collapsed = !collapsed;
    writeCollapsed('jobs', collapsed);
  }
  const rows = $derived(trackerRows(jobs));
  onMount(() => api.jobs.subscribe((v) => (jobs = v)));
</script>

{#if rows.length}
  <section class="card" data-testid="jobs-tracker">
    <div class="head">
      <button class="title" onclick={toggle} aria-expanded={!collapsed} data-testid="jobs-tracker-toggle">
        <span class="act">Jobs {rows.length}/{jobs.max}</span>
        <Icon name={collapsed ? 'chevDown' : 'chevUp'} size={16} />
      </button>
    </div>
    {#if !collapsed}<ul>
      {#each rows as r (r.key)}
        <li>
          <button class="row" class:warn={r.warn} title={r.title} data-testid="jobs-tracker-row" onclick={onOpen}>
            <b>{r.title}</b>
            <span class="fact"><Icon name="clock" size={12} />{r.fact}</span>
            <em>{r.state}</em>
          </button>
        </li>
      {/each}
    </ul>{/if}
  </section>
{/if}

<style>
  .card { box-sizing: border-box; width: 100%; padding: 6px 8px; background: var(--panel); border: 1px solid var(--line-hi); pointer-events: auto; }
  .head { display: flex; align-items: center; gap: 6px; margin: 0; }
  .title { flex: 1; display: flex; align-items: center; gap: 6px; min-height: 24px; padding: 0; border: 0; background: none; text-align: left; color: var(--text); }
  .act { font: 600 11px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-accent); white-space: nowrap; }
  .title :global(.icon) { margin-left: auto; color: var(--ink-accent); }
  ul { list-style: none; margin: 2px 0 0; padding: 0; display: grid; gap: 2px; }
  .row { display: grid; width: 100%; gap: 1px; padding: 4px 6px; border: 0; border-left: 2px solid var(--line-hi); background: var(--panel-2); text-align: left; font-size: 12px; min-height: 0; }
  .row:hover { background: var(--panel-3); }
  .row.warn { border-left-color: var(--amber); }
  .row b { color: var(--text); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fact { display: flex; align-items: center; gap: 4px; color: var(--dim); }
  em { font-style: normal; color: var(--ink-accent); }
  .warn em { color: var(--amber); }
</style>
