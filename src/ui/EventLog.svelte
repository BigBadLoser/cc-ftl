<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiLogEntry, UiLogKind } from './api';
  import Icon, { type IconName } from './Icon.svelte';

  let { api }: { api: UiApi } = $props();
  let list = $state<UiLogEntry[]>([]);
  let h = $state(0);
  const KEY = 'cc-ftl.log.open';
  const phone = () => window.matchMedia('(max-width: 600px)').matches;
  let open = $state(true);
  try {
    const v = localStorage.getItem(KEY);
    open = v === null ? !phone() : v === '1';
  } catch {
    open = !phone();
  }
  const toggle = () => {
    open = !open;
    try { localStorage.setItem(KEY, open ? '1' : '0'); } catch { /* storage may be blocked */ }
  };

  /** Other panels sit below the log (alerts, the combat panel), so tell them how tall it is. */
  $effect(() => {
    document.documentElement.style.setProperty('--log-h', `${list.length ? h + 4 : 0}px`);
  });
  onMount(() => api.log.subscribe((l) => (list = l)));

  const icon: Record<UiLogKind, IconName> = {
    fire: 'fire', breach: 'alert', 'crew.downed': 'downed', 'crew.died': 'skull', 'crew.rescued': 'person', 'module.destroyed': 'module',
    combat: 'combat', 'ship.disabled': 'ship', 'ship.destroyed': 'prize', 'ship.fled': 'fast', 'ship.captured': 'flag', hail: 'hail',
    trade: 'credits', production: 'wrench', container: 'stock', story: 'list', lost: 'skull',
  };
  const shown = $derived(open ? list : list.slice(0, 1));
</script>

{#if list.length}
  <div class="log" class:open data-testid="event-log" role="log" aria-label="Event log" bind:clientHeight={h}>
    <ul>
      {#each shown as e (e.id)}
        <li class={e.tone} data-testid="log-entry" data-kind={e.kind}>
          <span class="ic"><Icon name={icon[e.kind]} size={14} /></span>
          <span class="tx">{e.text}</span>{#if e.count > 1}<span class="n">×{e.count}</span>{/if}
          <span class="tk">T{e.tick}</span>
        </li>
      {/each}
    </ul>
    <button class="tile tg" title={open ? 'Collapse the log' : 'Expand the log'} aria-label={open ? 'Collapse the log' : 'Expand the log'} aria-expanded={open} data-testid="log-toggle" onclick={toggle}><Icon name={open ? 'chevUp' : 'chevDown'} size={14} /></button>
  </div>
{/if}

<style>
  .log { position: fixed; z-index: 4; right: calc(8px + var(--sar)); top: calc(var(--sat) + 8px); width: min(260px, calc(100vw - 110px)); background: var(--panel); border: 1px solid var(--line); }
  ul { list-style: none; margin: 0; padding: 0; max-height: 110px; overflow-y: auto; touch-action: pan-y; }
  .open ul { padding-right: 0; }
  li { display: flex; align-items: center; gap: 6px; height: 22px; padding: 0 6px; font-size: 12px; border-left: 3px solid var(--line-hi); white-space: nowrap; }
  li + li { border-top: 1px solid #0d2233; }
  li.good { border-left-color: var(--green); } li.warn { border-left-color: var(--amber); } li.bad { border-left-color: var(--red); }
  .ic { display: inline-flex; color: var(--cyan); } .good .ic { color: var(--green); } .warn .ic { color: var(--amber); } .bad .ic { color: var(--red); }
  .tx { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--text); }
  li:not(:first-child) .tx { color: var(--dim); }
  .n { color: var(--amber); font: 600 12px var(--head-font); }
  .tk { color: var(--dim); font: 600 11px var(--head-font); letter-spacing: 0.05em; }
  /* The toggle rides on the first row, right of the time stamp. */
  .tg { position: absolute; top: 0; right: 0; width: 22px; height: 22px; border-width: 0 0 1px 1px; background: var(--panel-2); }
  li:first-child { padding-right: 28px; }
  @media (max-width: 600px) {
    .log { right: auto; left: 8px; top: calc(var(--hdr) + var(--sat) + 6px); width: calc(100vw - 62px - var(--sar)); }
  }
</style>
