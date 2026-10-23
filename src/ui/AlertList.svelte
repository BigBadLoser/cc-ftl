<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiAlert, UiApi } from './api';
  import Icon, { type IconName } from './Icon.svelte';

  let { api }: { api: UiApi } = $props();
  let list = $state<UiAlert[]>([]);
  onMount(() => api.alerts.subscribe((a) => (list = a)));

  const danger = new Set(['fire.started', 'hull.breach', 'crew.died', 'crew.downed', 'crew.starving', 'o2.low', 'suit.airLow', 'suit.airOut', 'combat.started', 'module.destroyed', 'ship.lost', 'creatures.aboard', 'ship.provoked', 'galaxy.encounter', 'galaxy.incomingHostile']);
  const good = new Set(['production.done', 'crew.rescued', 'ship.destroyed', 'trade']);
  const icon: Record<string, IconName> = {
    'fire.started': 'fire', 'hull.breach': 'alert', 'power.shortage': 'power', 'o2.low': 'o2', 'suit.airLow': 'o2', 'suit.airOut': 'o2', 'crew.downed': 'downed', 'crew.starving': 'food', 'crew.moodLow': 'smile', 'crew.died': 'skull',
    'crew.rescued': 'person', 'combat.started': 'combat', 'creatures.aboard': 'combat', 'outpost.discovered': 'station', 'ship.provoked': 'combat', 'mining.waiting': 'person', 'mining.done': 'pick', 'module.destroyed': 'close', 'ship.destroyed': 'prize', 'ship.fled': 'ship', 'ship.lost': 'skull', 'job.missingMaterials': 'stock', 'storage.full': 'stock', 'production.done': 'wrench', trade: 'credits', 'galaxy.encounter': 'alert', 'galaxy.incomingHostile': 'alert', 'galaxy.incoming': 'ship',
  };
</script>

{#if list.length}
<div class="alerts" data-testid="alerts">
  {#each list.slice(0, 4) as a (a.id)}
    <div class="alert" class:danger={danger.has(a.kind)} class:good={good.has(a.kind)} data-testid="alert" data-kind={a.kind}>
      {#if a.notice}
        <button class="go story" data-testid="story-notice" disabled={!a.notice.lead} onclick={() => { if (a.notice) api.dispatch({ type: 'story.openNotice', notice: a.notice.id }); api.dismissAlert(a.id); }}>
          <b>{a.notice.title}</b>
          <span class="body">{a.text}</span>
          {#if a.notice.lead}<span class="tap">Tap to look</span>{/if}
        </button>
      {:else}
        <button class="go" disabled={!a.at} onclick={() => api.focusAlert(a.id)}><span class="ic"><Icon name={icon[a.kind] ?? 'alert'} size={16} /></span><span class="t" title={a.text}>{a.text}</span></button>
      {/if}
      <button class="x" aria-label="Dismiss" onclick={() => api.dismissAlert(a.id)}><Icon name="close" size={14} /></button>
    </div>
  {/each}
  {#if list.length > 4}<div class="more">+{list.length - 4} more</div>{/if}
</div>
{/if}

<style>
  /* Separate cards under the log/time frame, stacked downward. */
  /* With the combat panel open on the right the alerts step left of it, instead of hiding under it. */
  @media (min-width: 601px) { :global(:root[data-combat]) .alerts { transform: translateX(-380px); } }
  .alerts { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; width: 100%; }
  .alert { display: flex; min-width: 0; background: var(--panel); border: 1px solid var(--amber); border-left-width: 3px; }
  .alert.danger { border-color: var(--red); }
  .alert.good { border-color: var(--green); }
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
  .danger .ic { color: var(--red); } .good .ic { color: var(--green); }
  .more { color: var(--dim); font-size: 12px; padding-left: 4px; }
  @media (max-width: 600px) { :global(html[data-combat]) .alerts { display: none; } }
</style>
