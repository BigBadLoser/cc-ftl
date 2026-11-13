<script lang="ts">
  /**
   * The event grid card: a deep-space pocket opened by an interdiction fight, a distress call or a story encounter. Who is out there and what each
   * ship is doing (its state, read live), and the way back onto the trip: "Resume travel" once clear, "Flee" while hostiles are about (it spends the
   * charged drive). Set in the same thin frame as the combat cards; a ship's row frames it in the view.
   */
  import Icon from './Icon.svelte';
  import { Chip, chipTone, DecisionBar, type DecisionOption, Frame, tip } from './kit';
  import type { UiApi } from './api';
  import type { UiEventGrid, UiEncounterResult } from './starmapApi';

  let { api, event, result }: { api: UiApi; event: UiEventGrid; result: UiEncounterResult | null } = $props();

  const leave = () => api.dispatch({ type: 'galaxy.leaveEvent' });
  const help = () => event.aid && api.dispatch({ type: 'galaxy.aid', ship: event.aid.ship });
  const callPod = () => event.pod && api.dispatch({ type: 'galaxy.recoverPod', pod: event.pod.pod });
  const answer = (grant: boolean) => event.dockRequest && api.dispatch({ type: 'galaxy.visit', ship: event.dockRequest.ship, grant });
  const title = $derived(event.title.replace(/^Deep space: /, ''));
  const quiet = $derived(
    event.hostiles > 0 ? `${event.hostiles} hostile ship${event.hostiles > 1 ? 's' : ''} in range`
    : event.kind === 'rescue' ? 'All quiet. Help them, then move on.' : event.kind === 'scene' ? 'Nobody here is hostile.' : 'The sky is clear: the fight is won.',
  );
  /**
   * The card's decision bar (at most 3): the open ask (the dock request's Let them dock / Refuse, else the aid or the pod call) is primary while it
   * stands and Resume travel then plain; with no ask, Resume travel is primary. Refuse is a `cancel` option, so the bar puts it last. Asks beyond
   * the three slots are left out (the content never opens a dock request, an aid and a pod together).
   */
  const decisions = $derived.by<DecisionOption[]>(() => {
    const asks: DecisionOption[] = [];
    if (event.dockRequest) asks.push({ id: 'allow', label: 'Let them dock', primary: true, testId: 'dock-allow' }, { id: 'refuse', label: 'Refuse', cancel: true, testId: 'dock-refuse' });
    if (event.aid?.action) asks.push({ id: 'aid', label: event.aid.action === 'offer' ? 'Offer help' : 'Send the repair party again', primary: true, testId: 'aid-offer' });
    if (event.pod?.action === 'call') asks.push({ id: 'pod', label: 'Bring the pod in', primary: true, testId: 'pod-call' });
    const shown = asks.slice(0, 2);
    const stay = shown.length === 0;
    const leaveOpt: DecisionOption = { id: 'leave', label: event.fleeing ? 'Flee and resume' : 'Resume travel', note: event.fleeing ? 'Spends the drive' : undefined, primary: stay && event.canLeave, disabled: !event.canLeave || event.deploying, testId: 'event-leave' };
    return [...shown.filter((o) => !o.cancel), leaveOpt, ...shown.filter((o) => o.cancel)];
  });
  const pick = (id: string) => {
    if (id === 'allow') answer(true);
    else if (id === 'refuse') answer(false);
    else if (id === 'aid') help();
    else if (id === 'pod') callPod();
    else leave();
  };
  const trip = $derived(event.hopsLeft === 0 ? `Trip ends at ${event.resumeTo}` : `To ${event.resumeTo} · ${event.hopsLeft} hop${event.hopsLeft === 1 ? '' : 's'}`);
</script>

<aside class="card" class:wide={decisions.length > 2} data-testid="event-panel" data-kind={event.kind}>
  <Frame title={title} tone={event.hostiles > 0 ? 'hostile' : 'normal'} style="pointer-events:auto; background: var(--panel)">
    {#snippet right()}
      <Chip plate>Off the map</Chip>
    {/snippet}
    <div class="body">
      <ul class="roster">
        {#each event.roster as r, i (i)}
          <li>
            <button class="row" disabled={!r.ship} use:tip={{ text: r.ship ? 'Show it' : undefined }} onclick={() => r.ship && api.focusFight(r.ship)}>
              <span class="who"><b>{r.name}</b><small>{r.owner}</small></span>
              <Chip plate tone={chipTone(r.tone)}>{r.status}</Chip>
            </button>
          </li>
        {/each}
      </ul>
      {#if event.dockRequest}
        <div class="ask" data-testid="dock-request">
          <p class="note ask-text"><Icon name="alert" size={14} />{event.dockRequest.text}</p>
        </div>
      {/if}
      {#if event.aid}
        <div class="ask" data-testid="aid">
          {#if event.aid.clock !== null}<p class="note warn" data-testid="aid-clock"><Icon name="alert" size={14} />{event.aid.name}: {(event.aid.failing ?? 'systems').toLowerCase()} failing, {event.aid.clock} s left</p>{/if}
          {#if event.aid.status}<p class="note ask-text">{event.aid.status}</p>{/if}
        </div>
      {/if}
      {#if event.pod}
        <div class="ask" data-testid="pod">
          {#if event.pod.clock !== null}<p class="note warn" data-testid="pod-clock"><Icon name="alert" size={14} />{event.pod.name}: bleeding out, {event.pod.clock} s left</p>{/if}
          <p class="note ask-text">{event.pod.status}</p>
        </div>
      {/if}
      <p class="note" class:warn={event.hostiles > 0}><Icon name={event.hostiles > 0 ? 'alert' : 'shield'} size={14} />{quiet}</p>
      {#if result && result.tone === 'red' && event.hostiles > 0}<p class="note warn" data-testid="event-result">{result.text}</p>{/if}
      <p class="note"><Icon name="map" size={14} />{trip}</p>
      {#if event.why && !event.deploying}<p class="note warn">{event.why}</p>{/if}
    </div>
    <DecisionBar options={decisions} onpick={pick} />
  </Frame>
</aside>

<style>
  /* Top centre, clear of the crew bar; the combat panel (left) and the right column keep their space. */
  .card { position: fixed; top: calc(var(--hdr) + var(--sat) + 10px); left: 50%; transform: translateX(-50%); width: min(380px, calc(100vw - 16px)); z-index: 6; pointer-events: none; }
  .card.wide { width: min(560px, calc(100vw - 16px)); }
  .body { display: grid; gap: 8px; padding: 6px 10px 10px; }
  .roster { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  .row { width: 100%; min-height: 36px; display: flex; align-items: center; gap: 8px; padding: 4px 8px; background: var(--panel-2); border: 1px solid var(--line); text-align: left; }
  .row:disabled { opacity: 0.7; cursor: default; }
  .who { flex: 1; min-width: 0; display: grid; }
  .who b { font-weight: 600; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .who small { color: var(--dim); font-size: 11px; }
  .note { margin: 0; font-size: 12px; display: flex; gap: 6px; align-items: flex-start; color: var(--dim); }
  .note :global(svg) { flex: none; margin-top: 1px; }
  .warn { color: var(--red); }
  .ask { display: grid; gap: 6px; padding: 6px 8px; background: var(--panel-2); border: 1px solid var(--amber, var(--line)); }
  .ask-text { color: var(--text); }
</style>
