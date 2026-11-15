<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiPrisonerDeal } from './api';

  /**
   * The channel's Prisoners service (#116): every prisoner the player holds, frozen or not, with this station's offer as a button (ransom, bounty,
   * black market; capture/offers.ts) only where it makes one; any other row has one dim line of where to take them. Handing over sends 'prisoner.handOver'.
   */
  let { api, station, deals }: { api: UiApi; station: number; deals: UiPrisonerDeal[] } = $props();
  // Portraits load with the crew sheets: poll until every one has drawn.
  let rev = $state(0);
  onMount(() => {
    const t = setInterval(() => { rev++; if (deals.every((d) => api.portrait(d.id))) clearInterval(t); }, 500);
    return () => clearInterval(t);
  });
  const pic = (id: number): string | null => (void rev, api.portrait(id));
</script>

<div class="list" data-testid="prisoner-deals">
  <div class="head"><span>Held prisoner</span><span>This station</span></div>
  <ul>
    {#each deals as d (d.id)}
      {@const src = pic(d.id)}
      <li data-testid="prisoner-deal">
        <div class="face" class:frozen={d.frozen}>{#if src}<img {src} alt="" />{/if}{#if d.frozen}<span class="snow" title="Frozen in stasis">*</span>{/if}</div>
        <div class="who">
          <b>{d.name}</b>
          <span class="sub"><span class="fac {d.tier}">{d.faction}</span> · {d.where}</span>
        </div>
        <div class="deal">
          {#if d.offer.ok}<button class="ok" data-testid="prisoner-handover" onclick={() => api.dispatch({ type: 'prisoner.handOver', crew: d.id, station })}>{d.offer.label}</button>{/if}
          {#if d.offer.note}<span class="note" class:why={!d.offer.ok} data-testid={d.offer.ok ? undefined : 'prisoner-why'}>{d.offer.note}</span>{/if}
        </div>
      </li>
    {/each}
  </ul>
  <p class="foot">The prisoner goes over as the sealed slab; you keep the empty slab.</p>
</div>

<style>
  .head { display: flex; justify-content: space-between; padding: 0 2px 4px 44px; color: var(--dim); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; }
  li { display: grid; grid-template-columns: 36px 1fr auto; gap: 8px; align-items: center; padding: 7px 2px; border-top: 1px solid var(--line); }
  li:last-child { border-bottom: 1px solid var(--line); }
  .face { position: relative; width: 36px; height: 36px; overflow: hidden; }
  .face img { width: 36px; height: 36px; image-rendering: pixelated; }
  .face.frozen img { filter: saturate(0.3) brightness(1.1) hue-rotate(150deg); }
  .snow { position: absolute; right: 0; bottom: -2px; color: #dff6ff; font-size: 14px; font-weight: 700; }
  .who { display: grid; gap: 2px; min-width: 0; }
  .who b { color: var(--text); font-weight: 600; }
  .sub { color: var(--dim); font-size: 12px; }
  .fac.friendly { color: var(--good, #4ad28a); }
  .fac.neutral { color: var(--ink-accent, #7fc8ff); }
  .fac.hostile { color: var(--bad, #e2554f); }
  .deal { display: grid; justify-items: end; gap: 3px; max-width: 220px; }
  .deal button { min-height: 28px; min-width: 150px; padding: 0 10px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
  .deal button.ok { border-color: var(--cyan); color: var(--cyan); }
  .note { color: var(--dim); font-size: 12px; text-align: right; }
  .note.why { opacity: 0.8; font-style: italic; }
  .foot { color: var(--dim); font-size: 12px; margin: 8px 0 0; }
</style>
