<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiLogEntry, UiLogKind } from './api';
  const PULSE_MS = 2500;
  const fresh = (e: UiLogEntry) => !!e.amount && Date.now() - e.born < PULSE_MS;
  const go = (e: UiLogEntry) => {
    if (!e.subject) return;
    if (e.subject.kind === 'node') onNode?.(e.subject.id);
    else api.focusSubject(e.subject);
  };
  import Icon, { type IconName } from './Icon.svelte';

  let { api, onNode }: { api: UiApi; onNode?: (node: string) => void } = $props();
  let list = $state<UiLogEntry[]>([]);
  const KEY = 'cc-ftl.log.open';
  let open = $state(true);
  try {
    const v = localStorage.getItem(KEY);
    open = v === '1';
  } catch {
    open = false;
  }
  const toggle = () => {
    open = !open;
    try { localStorage.setItem(KEY, open ? '1' : '0'); } catch { /* storage may be blocked */ }
  };

  onMount(() => api.log.subscribe((l) => (list = l)));

  const icon: Record<UiLogKind, IconName> = {
    fire: 'fire', breach: 'alert', 'crew.downed': 'downed', 'crew.died': 'skull', 'crew.rescued': 'person', 'module.destroyed': 'module',
    combat: 'combat', 'ship.disabled': 'ship', 'ship.destroyed': 'prize', 'ship.fled': 'fast', 'ship.captured': 'flag', hail: 'hail',
    trade: 'credits', production: 'wrench', container: 'stock', story: 'list', lost: 'skull',
    payout: 'credits', kill: 'skull', warning: 'alert', job: 'stock', mining: 'pick', transfer: 'stock', galaxy: 'ship', outpost: 'station', creatures: 'combat', crew: 'person',
  };
  const shown = $derived(open ? list : list.slice(0, 1));
</script>

{#if list.length}
  <div class="log sec" class:open data-testid="event-log" role="log" aria-label="Ship's log">
    <button class="bar" title={open ? 'Collapse the log' : 'Expand the log'} aria-label={open ? 'Collapse the log' : 'Expand the log'} aria-expanded={open} data-testid="log-toggle" onclick={toggle}>
      <span class="cap">Ship's log</span><Icon name={open ? 'chevUp' : 'chevDown'} size={14} />
    </button>
    <ul>
      {#each shown as e (e.id)}
        <li class={e.tone} class:pulse={fresh(e)} data-testid="log-entry" data-kind={e.kind}>
          <button class="row" disabled={!e.subject} title={e.subject ? 'Go there' : undefined} onclick={() => go(e)}>
            <span class="ic"><Icon name={icon[e.kind]} size={14} /></span>
            <span class="tx">{e.text}</span>{#if e.amount}<span class="amt" data-testid="log-amount">+{e.amount} ₵</span>{/if}{#if e.count > 1}<span class="n">×{e.count}</span>{/if}
            <span class="tk">T{e.tick}</span>
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .log { width: 100%; }
  /* Title bar in the goals card's small caps; the collapse arrow lives here, not over the entries. */
  .bar { display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 0; height: 24px; padding: 0 8px; border: 0; border-bottom: 1px solid var(--line); background: var(--panel-2); color: var(--cyan); cursor: pointer; }
  .cap { font: 600 11px/1 var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--cyan); }
  /* Five full rows, then it scrolls. */
  ul { list-style: none; margin: 0; padding: 0; max-height: 110px; overflow-y: auto; touch-action: pan-y; }
  li { height: 22px; box-sizing: border-box; font-size: 12px; --tone: var(--line-hi); box-shadow: inset 3px 0 0 var(--tone); white-space: nowrap; }
  .row { display: flex; align-items: center; gap: 6px; box-sizing: border-box; width: 100%; height: 22px; min-height: 0; margin: 0; padding: 0 8px 0 6px; border: 0; background: transparent; font: inherit; line-height: 1; text-align: left; color: inherit; cursor: pointer; }
  .row > * { line-height: 1; }
  .row:disabled { cursor: default; opacity: 1; }
  .row:not(:disabled):hover { background: #0d2233; }
  li + li { border-top: 1px solid #0d2233; }
  /* The tone strip is an inset shadow, so the divider above each row runs the full width, over its top. */
  li.good { --tone: var(--green); } li.warn { --tone: var(--amber); } li.bad { --tone: var(--red); }
  .ic { display: inline-flex; color: var(--cyan); } .good .ic { color: var(--green); } .warn .ic { color: var(--amber); } .bad .ic { color: var(--red); }
  .tx { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--text); }
  li:not(:first-child) .tx { color: var(--dim); }
  .n { color: var(--amber); font: 600 12px var(--head-font); }
  .amt { color: var(--green); font: 700 13px var(--head-font); letter-spacing: 0.04em; }
  /* A credit gain: the row glows for a couple of seconds, then settles. */
  li.pulse { animation: payout 2.4s ease-out 1; }
  li.pulse .amt { animation: amt 2.4s ease-out 1; }
  @keyframes payout { 0%, 25% { background: color-mix(in srgb, var(--green) 38%, transparent); box-shadow: inset 3px 0 0 var(--tone), 0 0 12px var(--green), inset 0 0 8px color-mix(in srgb, var(--green) 50%, transparent); } 100% { background: transparent; box-shadow: inset 3px 0 0 var(--tone); } }
  @keyframes amt { 0%, 25% { transform: scale(1.25); text-shadow: 0 0 8px var(--green); } 100% { transform: scale(1); text-shadow: none; } }
  .tk { color: var(--dim); font: 600 11px var(--head-font); letter-spacing: 0.05em; }
</style>
