<script lang="ts">
  import type { UiApi, UiBlueprint } from './api';

  /** The module blueprints a station sells: a bought one is known at once and shows in the build menu. */
  let { api, port, blueprints, credits }: { api: UiApi; port: string; blueprints: UiBlueprint[]; credits: number } = $props();
  const MK = ['', 'Mk I', 'Mk II', 'Mk III'];
</script>

<div data-testid="blueprint-list">
  {#if !blueprints.length}<p class="none">Nothing on offer at this danger level.</p>{/if}
  <ul>
    {#each blueprints as b (b.def)}
      {@const poor = b.price > credits}
      <li data-testid="blueprint" class:known={b.known}>
        <div class="t"><b>{b.name}</b><span class="pay">{b.known ? 'Known' : `${b.price} cr`}</span></div>
        <div class="d">{MK[b.tier] ?? ''} · {b.w}×{b.h} tiles{b.blurb ? ` · ${b.blurb}` : ''}</div>
        {#if !b.known}
          {#if poor}<div class="warn">Not enough credits</div>{/if}
          <button data-testid="blueprint-buy" disabled={poor} onclick={() => api.dispatch({ type: 'blueprint.buy', port, def: b.def })}>Buy blueprint</button>
        {/if}
      </li>
    {/each}
  </ul>
  <p class="note">A blueprint unlocks the module for building on your ship. Deeper stations sell better tiers, at higher prices.</p>
</div>

<style>
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  li { display: grid; gap: 3px; padding: 8px; background: var(--panel-2); border: 1px solid var(--line); }
  li.known { opacity: 0.6; }
  .t { display: flex; justify-content: space-between; gap: 8px; }
  .t b { color: var(--text); font-weight: 600; }
  .pay { color: #ffd77a; font-weight: 600; white-space: nowrap; }
  .d { color: var(--dim); font-size: 12px; }
  .warn { color: var(--red); font-size: 12px; }
  li button { justify-self: end; min-height: 30px; padding: 0 12px; }
  .none, .note { color: var(--dim); font-size: 12px; margin: 2px 0; }
  .note { margin-top: 8px; }
</style>
