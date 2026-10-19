<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiAlert, UiApi } from './api';

  let { api }: { api: UiApi } = $props();
  let list = $state<UiAlert[]>([]);
  onMount(() => api.alerts.subscribe((a) => (list = a)));

  const danger = new Set(['fire.started', 'hull.breach', 'crew.died', 'crew.downed', 'o2.low', 'suit.airLow', 'suit.airOut', 'combat.started', 'module.destroyed', 'ship.lost']);
  const good = new Set(['production.done', 'crew.rescued', 'ship.destroyed']);
  const icon: Record<string, string> = {
    'fire.started': '🔥', 'hull.breach': '💨', 'power.shortage': '⚡', 'o2.low': 'O₂', 'suit.airLow': 'O₂', 'suit.airOut': 'O₂', 'crew.downed': '✚', 'crew.died': '✝',
    'crew.rescued': '✔', 'combat.started': '⚔', 'module.destroyed': '✖', 'ship.destroyed': '★', 'ship.fled': '➚', 'ship.lost': '☠', 'job.missingMaterials': '▣', 'storage.full': '▣', 'production.done': '⚙',
  };
</script>

<div class="alerts" data-testid="alerts">
  {#each list.slice(0, 4) as a (a.id)}
    <div class="alert" class:danger={danger.has(a.kind)} class:good={good.has(a.kind)} data-testid="alert" data-kind={a.kind}>
      <button class="go" disabled={!a.at} onclick={() => api.focusAlert(a.id)}><span class="ic">{icon[a.kind] ?? '!'}</span>{a.text}</button>
      <button class="x" aria-label="Dismiss" onclick={() => api.dismissAlert(a.id)}>×</button>
    </div>
  {/each}
  {#if list.length > 4}<div class="more">+{list.length - 4} more</div>{/if}
</div>

<style>
  .alerts { position: fixed; z-index: 4; left: calc(8px + var(--sal)); top: calc(var(--hdr) + var(--sat) + 58px); display: grid; gap: 4px; width: min(250px, calc(100vw - 110px)); pointer-events: none; }
  .alert { display: flex; pointer-events: auto; background: var(--panel); border: 1px solid var(--amber); border-radius: 8px; overflow: hidden; }
  .alert.danger { border-color: var(--red); }
  .alert.good { border-color: #3fae6a; }
  .alert button { min-height: 34px; border: 0; border-radius: 0; background: transparent; font-size: 13px; }
  .go { flex: 1; text-align: left; padding: 0 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .x { min-width: 34px; padding: 0; color: var(--dim); font-size: 18px; }
  .ic { display: inline-block; width: 1.6em; }
  .more { color: var(--dim); font-size: 12px; padding-left: 4px; }
</style>
