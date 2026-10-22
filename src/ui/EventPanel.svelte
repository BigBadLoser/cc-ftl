<script lang="ts">
  /**
   * The event grid card: a deep-space pocket opened by an interdiction fight or a distress call. Shows who is out there, how the encounter
   * began, and the way back onto the trip: "Resume travel" once clear, "Flee" while hostiles are about (it spends the charged drive).
   */
  import Icon from './Icon.svelte';
  import PanelHead from './PanelHead.svelte';
  import type { UiApi } from './api';
  import type { UiEventGrid, UiEncounterResult } from './starmapApi';
  import { toneColor } from './starmapStyle';

  let { api, event, result }: { api: UiApi; event: UiEventGrid; result: UiEncounterResult | null } = $props();

  const leave = () => api.dispatch({ type: 'galaxy.leaveEvent' });
  const status = $derived(
    event.hostiles > 0 ? `${event.hostiles} hostile ship${event.hostiles > 1 ? 's' : ''} in range`
    : event.kind === 'rescue' ? 'All quiet. Help them, then move on.' : 'The sky is clear: the fight is won.',
  );
</script>

<aside class="sheet card" data-testid="event-panel" data-kind={event.kind}>
  <PanelHead icon="combat" title={event.title} sub="Event grid" foe={event.hostiles > 0} />
  <div class="who">
    <i style={`background: ${toneColor(event.tone)}`}></i>
    <b>{event.faction} {event.role.toLowerCase()}</b>
    <small>{event.ships === 0 ? 'none left' : `${event.ships} ship${event.ships === 1 ? '' : 's'}`}</small>
  </div>
  <p class="note" class:warn={event.hostiles > 0}><Icon name={event.hostiles > 0 ? 'alert' : 'shield'} size={14} />{status}</p>
  {#if result && result.tone === 'red' && event.hostiles > 0}<p class="note result" data-testid="event-result">{result.text}</p>{/if}
  <p class="note dim"><Icon name="map" size={14} />Trip to {event.resumeTo}, {event.hopsLeft} hop{event.hopsLeft === 1 ? '' : 's'} left. This pocket is not on the map and is gone when you leave.</p>
  <button class="go" class:on={event.canLeave} class:flee={event.fleeing} disabled={!event.canLeave || event.deploying} onclick={leave} data-testid="event-leave">
    <Icon name={event.fleeing ? 'evasion' : 'fast'} size={18} />{event.fleeing ? 'Flee and resume' : 'Resume travel'}
  </button>
  {#if event.why && !event.deploying}<p class="note warn">{event.why}</p>{/if}
</aside>

<style>
  .card { display: grid; gap: 6px; box-sizing: border-box; top: calc(var(--hdr) + var(--sat) + 8px); left: 50%; transform: translateX(-50%); width: min(340px, calc(100vw - 16px)); z-index: 6; }
  .who { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .who i { width: 8px; height: 8px; flex: none; clip-path: polygon(100% 50%, 0 0, 25% 50%, 0 100%); }
  .who b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  small { color: var(--dim); font-size: 11px; }
  .note { margin: 0; font-size: 12px; display: flex; gap: 6px; align-items: flex-start; }
  .note :global(svg) { flex: none; margin-top: 1px; }
  .warn { color: var(--red); }
  .dim { color: var(--dim); }
  .result { color: var(--red); }
  button { display: flex; align-items: center; justify-content: center; gap: 8px; font: 600 15px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
  .go { border-color: var(--cyan); background: var(--panel-3); color: var(--text); }
  .go.flee { border-color: var(--red); }
  @media (max-width: 600px) { .card { top: auto; bottom: 0; left: 0; right: 0; transform: none; width: auto; border-width: 1px 0 0; padding-bottom: calc(10px + var(--sab)); } }
</style>
