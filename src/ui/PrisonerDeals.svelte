<script lang="ts">
  import type { UiApi, UiPrisonerDeal } from './api';
  import Face from './crew/Face.svelte';

  /**
   * The channel's Prisoners service (#116): every prisoner the player holds, frozen or not, with this station's offer as a button (ransom, bounty,
   * black market; capture/offers.ts) only where it makes one; any other row has one dim line of where to take them. Accepting sends 'prisoner.handOver':
   * a shuttle comes for the slab, and the row shows the run ("Loading your shuttle…" or "Collecting…", then "On the way to the station"; Cancel while it can be) in place of the button.
   */
  let { api, station, deals }: { api: UiApi; station: number; deals: UiPrisonerDeal[] } = $props();
</script>

<div class="list" data-testid="prisoner-deals">
  <div class="head"><span>Held prisoner</span><span>This station</span></div>
  <ul>
    {#each deals as d (d.id)}
      <li data-testid="prisoner-deal">
        <Face {api} id={d.id} size={36} frozen={d.frozen} />
        <div class="who">
          <b>{d.name}</b>
          <span class="sub"><span class="fac {d.tier}">{d.faction}</span> · {d.where}</span>
        </div>
        <div class="deal">
          {#if d.offer.status}
            <span class="status" data-testid="prisoner-status">{d.offer.status}</span>
            {#if d.offer.cancel !== undefined}<button class="cancel" data-testid="prisoner-cancel" onclick={() => api.dispatch({ type: 'trade.cancel', id: d.offer.cancel! })}>Cancel</button>{/if}
          {/if}
          {#if d.offer.ok}<button class="ok" data-testid="prisoner-handover" onclick={() => api.dispatch({ type: 'prisoner.handOver', crew: d.id, station })}>{d.offer.label}</button>{/if}
          {#if d.offer.note}<span class="note" class:why={!d.offer.ok && !d.offer.status} data-testid={d.offer.ok || d.offer.status ? undefined : 'prisoner-why'}>{d.offer.note}</span>{/if}
        </div>
      </li>
    {/each}
  </ul>
  <p class="foot">A shuttle comes for the sealed slab, and you are paid when it reaches the station. The station keeps the slab: it is in the price.</p>
</div>

<style>
  .head { display: flex; justify-content: space-between; padding: 0 2px 4px 44px; color: var(--dim); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; }
  li { display: grid; grid-template-columns: 36px 1fr auto; gap: 8px; align-items: center; padding: 7px 2px; border-top: 1px solid var(--line); }
  li:last-child { border-bottom: 1px solid var(--line); }
  .who { display: grid; gap: 2px; min-width: 0; }
  .who b { color: var(--text); font-weight: 600; }
  .sub { color: var(--dim); font-size: 12px; }
  .fac.friendly { color: var(--good, #4ad28a); }
  .fac.neutral { color: var(--ink-accent, #7fc8ff); }
  .fac.hostile { color: var(--bad, #e2554f); }
  .deal { display: grid; justify-items: end; gap: 3px; max-width: 220px; }
  .deal button { min-height: 28px; min-width: 150px; padding: 0 10px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
  .deal button.ok { border-color: var(--cyan); color: var(--cyan); }
  .status { color: var(--cyan); font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; }
  .deal button.cancel { min-width: 0; min-height: 22px; font-size: 11px; }
  .note { color: var(--dim); font-size: 12px; text-align: right; }
  .note.why { opacity: 0.8; font-style: italic; }
  .foot { color: var(--dim); font-size: 12px; margin: 8px 0 0; }
</style>
