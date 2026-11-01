<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiAlert, UiAlertKind, UiApi } from './api';
  import Icon, { type IconName } from './Icon.svelte';
  import { splitAlerts } from './phoneHud';

  let { api, onNode, onMenu }: { api: UiApi; onNode?: (node: string) => void; onMenu?: (page: 'save') => void } = $props();
  const jump = (a: UiAlert) => {
    if (a.menu) onMenu?.(a.menu);
    else if (a.report) api.openFightReport(a.id);
    else if (a.subject?.kind === 'node') onNode?.(a.subject.id);
    else api.focusAlert(a.id);
  };
  let list = $state<UiAlert[]>([]);
  /** Phone: one compact toast (the newest) with a count badge; a tap opens the whole list under it. */
  let narrow = $state(false);
  let open = $state(false);
  onMount(() => {
    const mq = window.matchMedia('(max-width: 600px)');
    const onMq = () => (narrow = mq.matches);
    onMq();
    mq.addEventListener('change', onMq);
    const un = api.alerts.subscribe((a) => (list = a));
    return () => { un(); mq.removeEventListener('change', onMq); };
  });
  $effect(() => { if (list.length < 1) open = false; });
  const split = $derived(splitAlerts(list));
  const extra = $derived(split.extra);

  /** Every alert is urgent: red for threats to the ship and crew, amber for shortages. */
  const danger = new Set(['fire.started', 'hull.breach', 'crew.downed', 'crew.starving', 'o2.low', 'suit.airLow', 'suit.airOut', 'combat.started', 'creatures.aboard', 'galaxy.incomingHostile', 'boarders.stranded', 'save.failed']);
  const icon: Record<UiAlertKind, IconName> = {
    'fire.started': 'fire', 'hull.breach': 'alert', 'power.shortage': 'power', 'o2.low': 'o2', 'suit.airLow': 'o2', 'suit.airOut': 'o2', 'crew.downed': 'downed',
    'crew.starving': 'food', 'combat.started': 'combat', 'creatures.aboard': 'combat', 'galaxy.incomingHostile': 'alert', 'story.lead': 'list', 'fight.report': 'list', 'boarders.stranded': 'downed', 'save.failed': 'save',
  };
</script>

{#snippet row(a: UiAlert, toast = false)}
  <div class="alert" class:danger={danger.has(a.kind)} data-testid="alert" data-kind={a.kind}>
    {#if a.notice}
      <button class="go story" data-testid="story-notice" disabled={!a.notice.lead} onclick={() => { if (a.notice) api.dispatch({ type: 'story.openNotice', notice: a.notice.id }); api.dismissAlert(a.id); }}>
        <b>{a.notice.title}</b>
        <span class="body">{a.text}</span>
        {#if a.notice.lead}<span class="tap">Tap to look</span>{/if}
      </button>
    {:else}
      <button class="go" disabled={toast ? false : !a.subject && !a.report && !a.menu} aria-expanded={toast ? open : undefined} data-testid={toast ? 'alert-toast-text' : undefined} onclick={() => (toast ? (open = !open) : jump(a))}><span class="ic"><Icon name={icon[a.kind]} size={16} /></span><span class="t" title={a.text}>{a.text}</span></button>
    {/if}
    <button class="x" aria-label="Dismiss" onclick={() => api.dismissAlert(a.id)}><Icon name="close" size={14} /></button>
  </div>
{/snippet}

{#if list.length && narrow}
  <div class="alerts phone" data-testid="alerts">
    {#if open}
      <button class="badge head" aria-expanded="true" data-testid="alerts-more" onclick={() => (open = false)}>Notifications · {list.length}<Icon name="chevUp" size={14} /></button>
      <div class="drop full" data-testid="alerts-list">
        {#each list as a (a.id)}{@render row(a)}{/each}
      </div>
    {:else}
      <div class="toastrow">
        <div class="one">{@render row(split.top as UiAlert, true)}</div>
        {#if extra > 0}
          <button class="badge" aria-expanded="false" aria-label="Show {extra} more notifications" data-testid="alerts-more" onclick={() => (open = true)}>+{extra}<Icon name="chevDown" size={14} /></button>
        {/if}
      </div>
    {/if}
  </div>
{:else if list.length}
<div class="alerts" data-testid="alerts">
  {#each list.slice(0, 4) as a (a.id)}{@render row(a)}{/each}
  {#if list.length > 4}<div class="more">+{list.length - 4} more</div>{/if}
</div>
{/if}

<style>
  /* Separate cards under the log/time frame, stacked downward. */
  .alerts { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; width: 100%; }
  .alert { display: flex; min-width: 0; background: var(--panel); border: 1px solid var(--amber); border-left-width: 3px; }
  .alert.danger { border-color: var(--red); }
  .alert button { min-height: 32px; border: 0; background: transparent; font-size: 13px; }
  .go { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; text-align: left; padding: 4px 8px; overflow: hidden; }
  /* Two lines at most; the whole message on hover, or while the card holds focus (a tap on touch screens). */
  .go .t { min-width: 0; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; line-height: 1.25; overflow-wrap: anywhere; }
  .alert:hover .t, .alert:focus-within .t { -webkit-line-clamp: unset; line-clamp: none; }
  .go.story { display: block; white-space: normal; padding: 6px 8px; line-height: 1.3; font-size: 12px; opacity: 1; }
  .go.story b { display: block; font: 600 14px var(--head-font); color: var(--text); letter-spacing: 0.03em; }
  .go.story .body { display: block; color: var(--dim); }
  .go.story .tap { display: block; color: var(--cyan); margin-top: 2px; }
  .alert:has(.story) { border-color: var(--cyan); }
  .alert:has(.story:disabled) { border-color: var(--line); }
  .x { min-width: 32px; padding: 0; color: var(--dim); display: inline-flex; align-items: center; justify-content: center; }
  .ic { display: inline-flex; color: var(--amber); }
  .danger .ic { color: var(--red); }
  .more { color: var(--dim); font-size: 12px; padding-left: 4px; }
  /* Phone: a single-line toast, cyan-panel badge for the rest, the rest listed in a dropdown on tap. */
  .toastrow { display: flex; gap: 2px; align-items: stretch; }
  .one { flex: 1; min-width: 0; display: grid; }
  .phone .go .t { -webkit-line-clamp: 1; line-clamp: 1; }
  .phone .alert:hover .t, .phone .alert:focus-within .t { -webkit-line-clamp: 1; line-clamp: 1; }
  .phone .alert button { min-height: 30px; }
  .badge { flex: none; display: inline-flex; align-items: center; gap: 2px; padding: 0 8px; background: var(--panel); border: 1px solid var(--line-hi); color: var(--cyan); font: 600 13px var(--head-font); }
  .badge.head { width: 100%; justify-content: space-between; min-height: 30px; }
  .full .go .t, .full .alert:hover .t { -webkit-line-clamp: unset; line-clamp: none; }
  .drop { display: grid; gap: 2px; margin-top: 2px; max-height: 45vh; overflow-y: auto; }
</style>
