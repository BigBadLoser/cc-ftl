<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiJobs } from './api';
  import Icon from './Icon.svelte';
  import { readJobsOpen, writeJobsOpen } from './phoneHud';
  import { trackerRows } from './jobsTracker';

  /**
   * The accepted jobs, tracked under the goals card like a quest log: one row each with its key fact and state. Hidden with no jobs.
   * A row opens the Jobs window. Phone: a one-line chip ("Jobs 1 · first job") that expands on a tap, remembered for the session.
   */
  let { api, onOpen }: { api: UiApi; onOpen: () => void } = $props();
  let jobs = $state<UiJobs>({ here: null, offers: [], active: [], max: 0, mine: null });
  let narrow = $state(false);
  let openPhone = $state(readJobsOpen());
  const rows = $derived(trackerRows(jobs));
  const collapsed = $derived(narrow && !openPhone);
  onMount(() => {
    const mq = window.matchMedia('(max-width: 600px)');
    const onMq = () => (narrow = mq.matches);
    onMq();
    mq.addEventListener('change', onMq);
    const un = api.jobs.subscribe((v) => (jobs = v));
    return () => { un(); mq.removeEventListener('change', onMq); };
  });
  function toggle() {
    openPhone = !openPhone;
    writeJobsOpen(openPhone);
  }
</script>

{#if rows.length}
  <section class="card" class:chip={collapsed} data-testid="jobs-tracker">
    <div class="head">
      {#if narrow}
        <button class="title" onclick={toggle} aria-expanded={!collapsed} data-testid="jobs-tracker-toggle">
          <span class="act">Jobs {rows.length}</span>
          {#if collapsed}<span class="sep">·</span><span class="name">{rows[0]?.title}</span>{/if}
          <Icon name={collapsed ? 'chevDown' : 'chevUp'} size={16} />
        </button>
      {:else}
        <span class="title static"><span class="act">Jobs {rows.length}/{jobs.max}</span></span>
      {/if}
    </div>
    {#if !collapsed}
      <ul>
        {#each rows as r (r.key)}
          <li>
            <button class="row" class:warn={r.warn} title={r.title} data-testid="jobs-tracker-row" onclick={onOpen}>
              <b>{r.title}</b>
              <span class="fact"><Icon name="clock" size={12} />{r.fact}</span>
              <em>{r.state}</em>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}

<style>
  .card { box-sizing: border-box; width: 100%; padding: 6px 8px; background: var(--panel); border: 1px solid var(--line-hi); pointer-events: auto; }
  .head { display: flex; align-items: center; gap: 6px; margin: 0; }
  .title { flex: 1; display: flex; align-items: baseline; gap: 6px; min-height: 24px; padding: 0; border: 0; background: none; text-align: left; color: var(--text); }
  .title.static { align-items: center; }
  .act { font: 600 11px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--cyan); white-space: nowrap; }
  ul { list-style: none; margin: 2px 0 0; padding: 0; display: grid; gap: 2px; }
  .row { display: grid; width: 100%; gap: 1px; padding: 4px 6px; border: 0; border-left: 2px solid var(--line-hi); background: var(--panel-2); text-align: left; font-size: 12px; min-height: 0; }
  .row:hover { background: var(--panel-3); }
  .row.warn { border-left-color: var(--amber); }
  .row b { color: var(--text); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fact { display: flex; align-items: center; gap: 4px; color: var(--dim); }
  em { font-style: normal; color: var(--cyan); }
  .warn em { color: var(--amber); }
  .chip { padding: 0 8px; }
  .chip .title { min-height: 32px; align-items: center; min-width: 0; }
  .title :global(.icon) { margin-left: auto; align-self: center; color: var(--cyan); }
  .name { min-width: 0; font: 600 13px var(--head-font); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sep { color: var(--dim); }
</style>
