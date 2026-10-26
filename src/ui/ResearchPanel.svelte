<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiResearch, UiResearchProject } from './api';
  import Icon from './Icon.svelte';
  import ItemIcon from './ItemIcon.svelte';

  let { api, onClose }: { api: UiApi; onClose: () => void } = $props();
  let rs = $state<UiResearch>({ ship: 0, labs: 0, workers: 0, projects: [], queue: [] });
  onMount(() => api.research.subscribe((v) => (rs = v)));

  const byId = $derived(new Map(rs.projects.map((p) => [p.id, p])));
  const queued = $derived(rs.queue.map((id) => byId.get(id)).filter((p): p is UiResearchProject => !!p));
  const rest = $derived(rs.projects.filter((p) => p.pos === null));
  const dur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const send = (type: 'queue' | 'cancel', project: string) => api.dispatch({ type: `research.${type}`, ship: rs.ship, project });
  const move = (project: string, to: number) => api.dispatch({ type: 'research.move', ship: rs.ship, project, to });
  /** The line under a queued project: what it is doing now. */
  function lineOf(p: UiResearchProject): string {
    if (p.status === 'active') return rs.workers === 0 ? 'No one at the lab' : `${Math.round(p.progress * 100)}%`;
    return p.pos === 0 ? 'Needs materials' : 'Waiting';
  }
</script>

{#snippet cost(p: UiResearchProject)}
  <span class="cost">
    {#each p.cost as c (c.item)}
      <span class="c" class:short={c.have < c.count} title="{c.name}: have {c.have}, need {c.count}"><ItemIcon {api} item={c.item} size={18} />{c.have}/{c.count}</span>
    {/each}
  </span>
{/snippet}

<aside class="rp" data-testid="research-panel" aria-label="Research">
  <div class="hd">
    <Icon name="research" size={18} /><b>Research</b>
    <span class="chip" data-testid="research-labs">{rs.labs} {rs.labs === 1 ? 'module' : 'modules'}</span>
    <button class="x" aria-label="Close" data-testid="research-close" onclick={onClose}><Icon name="close" size={16} /></button>
  </div>
  <div class="body">
    {#if rs.labs === 0}<p class="note" data-testid="research-nolab">Build a research module to start.</p>{/if}

    <h3>Queue <small>top first</small></h3>
    <ol class="queue" data-testid="research-queue">
      {#each queued as p, i (p.id)}
        <li class:active={p.status === 'active'} data-testid="queue-{p.id}">
          <div class="l1">
            <span class="n">{i + 1}</span><b>{p.name}</b>
            <span class="st" class:bad={p.status !== 'active' && p.pos === 0}>{lineOf(p)}</span>
            <span class="mv">
              <button aria-label="Move up" title="Move up" disabled={i === 0 || (i === 1 && queued[0]?.status === 'active')} data-testid="up-{p.id}" onclick={() => move(p.id, i - 1)}><Icon name="chevUp" size={14} /></button>
              <button aria-label="Move down" title="Move down" disabled={i === queued.length - 1 || p.status === 'active'} data-testid="down-{p.id}" onclick={() => move(p.id, i + 1)}><Icon name="chevDown" size={14} /></button>
              <button class="rm" aria-label="Cancel" title={p.status === 'active' ? 'Cancel (materials come back)' : 'Remove'} data-testid="cancel-{p.id}" onclick={() => send('cancel', p.id)}><Icon name="close" size={14} /></button>
            </span>
          </div>
          {#if p.status === 'active'}<div class="bar"><i style:width="{Math.round(p.progress * 100)}%"></i></div>
          {:else}<div class="l2">{@render cost(p)}</div>{/if}
          <div class="unl">Unlocks {p.unlocks.join(', ')}</div>
        </li>
      {:else}
        <li class="none">Nothing queued.</li>
      {/each}
    </ol>

    <h3>Projects</h3>
    <ul class="list" data-testid="research-projects">
      {#each rest as p (p.id)}
        <li class:known={p.status === 'known'} class:locked={p.status === 'locked'} data-testid="project-{p.id}">
          <div class="l1">
            <b>{p.name}</b>
            <span class="tm" title="One worker, no science"><Icon name="clock" size={13} />{dur(p.seconds)}</span>
            {#if p.status === 'known'}
              <span class="ok"><Icon name="check" size={14} /> Known</span>
            {:else if p.status === 'locked'}
              <span class="lock" data-testid="lock-{p.id}"><Icon name="lock" size={13} /> Needs {p.needs.join(', ')}</span>
            {:else}
              <button class="add" disabled={rs.labs === 0} data-testid="queue-add-{p.id}" onclick={() => send('queue', p.id)}>Queue</button>
            {/if}
          </div>
          <div class="l2">{@render cost(p)}<span class="unl">Unlocks {p.unlocks.join(', ')}</span></div>
        </li>
      {/each}
    </ul>
  </div>
</aside>

<style>
  .rp { position: fixed; z-index: 6; top: calc(var(--hdr) + var(--sat) + 4px); left: 50%; transform: translateX(-50%); box-sizing: border-box; width: min(640px, calc(100vw - 16px)); max-height: calc(100dvh - var(--hdr) - var(--sat) - 16px); display: grid; grid-template-rows: auto minmax(0, 1fr); background: rgba(4, 4, 4, 0.97); border: 1px solid var(--amber); color: var(--text); font-size: 13px; box-shadow: 0 6px 24px #000a; pointer-events: auto; }
  .hd { display: flex; align-items: center; gap: 8px; padding: 5px 6px 5px 10px; background: #000; border-bottom: 1px solid var(--amber); color: var(--amber); }
  .hd b { font: 700 15px var(--head-font); text-transform: uppercase; letter-spacing: 0.05em; }
  .chip { font-size: 11px; color: #ffe2a6; border: 1px solid var(--amber); padding: 0 5px; }
  .x { margin-left: auto; min-width: 28px; min-height: 28px; width: 28px; height: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center; color: var(--amber); background: transparent; border-color: transparent; }
  .x:hover { border-color: var(--amber); }
  .body { overflow-y: auto; padding: 4px 10px 10px; }
  h3 { margin: 10px 0 5px; font: 600 12px var(--head-font); text-transform: uppercase; letter-spacing: 0.06em; color: var(--amber); border-bottom: 1px solid #2c2c2c; padding-bottom: 3px; }
  h3 small { color: #8a8a8a; font-weight: normal; text-transform: none; letter-spacing: 0; margin-left: 6px; }
  .note { margin: 8px 0 0; color: var(--amber); }
  ol, ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  li { background: #0b0b0b; border: 1px solid #242424; padding: 5px 8px; }
  li.active { border-color: var(--amber); background: #000; }
  li.none { color: #8a8a8a; border-style: dashed; }
  li.known, li.locked { opacity: 0.6; }
  .l1 { display: flex; align-items: center; gap: 8px; min-height: 28px; }
  .l1 b { color: #f2f2f2; }
  .n { color: var(--amber); font: 700 13px var(--head-font); width: 12px; }
  .st { margin-left: auto; color: var(--amber); white-space: nowrap; }
  .st.bad { color: var(--red); }
  .tm { margin-left: auto; display: inline-flex; align-items: center; gap: 3px; color: #9a9a9a; font-size: 12px; }
  .tm + .ok, .tm + .lock, .tm + .add { margin-left: 4px; }
  .mv { display: inline-flex; gap: 3px; }
  button { min-height: 28px; min-width: 28px; background: #0b0b0b; color: var(--amber); border: 1px solid #3a2e12; }
  button:hover:not(:disabled) { border-color: var(--amber); }
  .mv button { padding: 0; display: inline-flex; align-items: center; justify-content: center; }
  .rm { color: var(--red); }
  .add { padding: 0 12px; border-color: var(--amber); }
  .add:hover:not(:disabled) { background: #2a1e06; }
  .ok { display: inline-flex; align-items: center; gap: 3px; color: #7fd38a; }
  .lock { display: inline-flex; align-items: center; gap: 3px; color: var(--amber); font-size: 12px; }
  .bar { height: 6px; margin: 4px 0; background: #1a1a1a; border: 1px solid #2c2c2c; }
  .bar > i { display: block; height: 100%; background: var(--amber); }
  .l2 { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-top: 2px; }
  .cost { display: inline-flex; flex-wrap: wrap; gap: 2px 12px; }
  .c { display: inline-flex; align-items: center; gap: 3px; color: #d4d4d4; }
  .c.short { color: var(--red); font-weight: 700; }
  .unl { color: #8a8a8a; font-size: 12px; }
  li > .unl { margin-top: 2px; }
</style>
