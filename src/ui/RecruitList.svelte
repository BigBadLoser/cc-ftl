<script lang="ts">
  import type { UiApi, UiTradeDeal, UiTradePartner } from './api';

  /** The people for hire aboard a station: hire sends the player's shuttle to pick the person up; the credits are held until they arrive. */
  let { api, partner, credits, deal }: { api: UiApi; partner: UiTradePartner; credits: number; deal: UiTradeDeal | undefined } = $props();
  const REASONS: Record<string, string> = {
    noShuttle: 'No shuttle to fetch them: fit one in a bay', courierBusy: 'Your shuttle is busy', noAirlock: 'No free working airlock to dock at',
  };
  const busy = $derived(!!deal);
</script>

<div data-testid="recruit-list">
  {#if !partner.recruits.length}<p class="none">Nobody here is looking for a berth.</p>{/if}
  <ul>
    {#each partner.recruits as r (r.key)}
      {@const poor = r.cost > credits}
      <li data-testid="recruit" class:coming={r.coming}>
        <div class="t"><b>{r.name}{#if r.shady}<span class="shady" data-testid="recruit-shady" title="Shady crew: better skills, one-time fee, no wages">shady +{r.shady}</span>{/if}</b><span class="pay">{r.cost} cr</span></div>
        <div class="d">{r.species} {r.role}{r.skills.length ? ` · ${r.skills.join(', ')}` : ''}</div>
        {#if r.coming}
          <div class="way" data-testid="recruit-coming">On the way: {deal?.status ?? 'shuttle fetching them'}</div>
          {#if deal?.cancellable}<button data-testid="recruit-cancel" onclick={() => api.dispatch({ type: 'trade.cancel', id: deal.id })}>Call off</button>{/if}
        {:else}
          {#if poor}<div class="warn">Not enough credits</div>
          {:else if busy}<div class="warn">The station has a run open</div>
          {:else if partner.hireError}<div class="warn">{REASONS[partner.hireError] ?? partner.hireError}</div>{/if}
          <button class="commit" data-testid="recruit-hire" disabled={poor || busy || !!partner.hireError} onclick={() => api.dispatch({ type: 'crew.hire', key: r.key })}>Hire</button>
        {/if}
      </li>
    {/each}
  </ul>
  <p class="note">Your shuttle flies to the station to pick them up. The fee is held until they step aboard, and refunded if the run fails.</p>
</div>

<style>
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  li { display: grid; gap: 3px; padding: 8px; background: var(--panel-2); border: 1px solid var(--line); }
  li.coming { border-color: var(--cyan); }
  .t { display: flex; justify-content: space-between; gap: 8px; }
  .t b { color: var(--text); font-weight: 600; }
  .shady { margin-left: 6px; padding: 0 5px; border: 1px solid var(--amber); color: var(--amber); font-size: 11px; font-weight: 600; text-transform: uppercase; }
  .pay { color: #ffd77a; font-weight: 600; white-space: nowrap; }
  .d { color: var(--dim); font-size: 12px; }
  .warn { color: var(--red); font-size: 12px; }
  .way { color: var(--ink-accent); font-size: 12px; }
  li button { justify-self: end; min-height: 30px; padding: 0 12px; }
  .none, .note { color: var(--dim); font-size: 12px; margin: 2px 0; }
  .note { margin-top: 8px; }
</style>
