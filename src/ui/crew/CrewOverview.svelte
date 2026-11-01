<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCrew, UiShuttles } from '../api';
  import type { UiCrewDetail } from '../crewDetailApi';
  import Icon from '../Icon.svelte';
  import { Chips } from '../kit';
  import StatBar from '../inspector/StatBar.svelte';
  import TraitChips from '../inspector/TraitChips.svelte';
  import { moodWord } from './format';

  /**
   * The crew Overview tab (and the whole view of a hostile): portrait, health and mood, what they are doing, the trait chips,
   * and the orders. Everything else is in the tabs.
   */
  let { api, c, onPriorities }: { api: UiApi; c: UiCrew; d?: UiCrewDetail | null; onPriorities: () => void } = $props();
  const enemy = $derived(c.side === 'enemy');
  let shuttles = $state<UiShuttles>({ shuttles: [], airlocks: [], targets: [], roster: [], bays: [], regions: [], transfers: [], ferryReady: false });
  let rev = $state(0);
  const pic = $derived((void rev, api.portrait(c.id)));
  const doing = $derived(c.dead ? 'Dead' : c.downed ? (c.downed.stabilized ? 'Downed, stabilized' : `Downed, bleeding out in ${c.downed.bleed} s`) : c.drafted ? 'Drafted' : `${c.job ?? c.activity}`);

  onMount(() => {
    const e = api.shuttles.subscribe((v) => (shuttles = v));
    // The portrait appears once its sprite sheets load.
    const t = setInterval(() => { if (!pic) rev++; }, 500);
    return () => (e(), clearInterval(t));
  });
</script>

<div data-testid="crew-overview">
  <div class="top">
    <span class="face" class:dead={c.dead}>{#if pic}<img src={pic} alt="" />{/if}</span>
    <div class="vitals">
      <div class="v" title="Health" data-testid="crew-health"><span class="ic"><Icon name="heart" size={16} /></span><StatBar value={(c.hp / c.maxHp) * 100} color="var(--hp)" low={c.hp / c.maxHp < 0.4} /><span class="n" class:bad={c.hp / c.maxHp < 0.4}>{c.dead ? 'dead' : `${c.hp}/${c.maxHp}`}</span></div>
      {#if c.mood && !enemy}<div class="v" title="Mood" data-testid="crew-mood"><span class="ic"><Icon name="smile" size={16} /></span><StatBar value={c.mood.value} color="#b58cff" low={c.mood.value < 35} /><span class="n">{c.mood.value} {moodWord(c.mood.value)}</span></div>{/if}
    </div>
  </div>
  <p class="doing" class:bad={c.dead || !!c.downed} data-testid="crew-activity"><span class="ic"><Icon name="wrench" size={14} /></span><span>{doing}</span></p>
  {#if !enemy && c.traits.length}<div class="traits"><TraitChips traits={c.traits} limit={2} testId="crew-traits" /></div>{/if}
  {#if enemy}
    <div class="btns one"><button class="warn" data-testid="attack-hostile" disabled={c.dead || c.surrendered || !!c.downed} onclick={() => api.attack(c.id)}>Attack</button></div>
  {:else}
    <div class="orders">
      <button class:on={c.drafted} title="{c.drafted ? 'Undraft' : 'Draft'} (R)" data-testid="draft" onclick={() => api.dispatch({ type: 'crew.draft', id: c.id, drafted: !c.drafted })}><Icon name="draft" size={18} /><span>{c.drafted ? 'Undraft' : 'Draft'}</span></button>
      <button title="Work priorities" data-testid="open-priorities" onclick={onPriorities}><Icon name="list" size={18} /><span>Priorities</span></button>
    </div>
    {#if shuttles.regions.length > 1 && shuttles.regions.some((r) => r.id === c.ship) && !c.dead && !c.downed}
      <div class="chips" data-testid="ferry-crew">
        <Chips label="Base trip" deselect value="" onChange={(to: string) => to && api.dispatch({ type: 'ferry.order', from: c.ship, to: Number(to), crew: [c.id] })}
          options={shuttles.regions.filter((r) => r.id !== c.ship).map((r) => ({ value: String(r.id), label: r.home ? 'Come home' : `Go to ${r.name}`, disabled: !shuttles.ferryReady, title: shuttles.ferryReady ? '' : 'No free shuttle', testId: `ferry-crew-${r.id}` }))} />
      </div>
    {/if}
    {#if c.drafted}
      {#if !c.airless}
        <div class="btns one">
          {#if c.suit && c.evaShuttle}
            <button data-testid="eva-board" onclick={() => c.evaShuttle && api.dispatch({ type: 'eva.board', crew: c.id, vehicle: c.evaShuttle })}>Back to shuttle</button>
          {:else if c.suit}
            <button data-testid="suit-off" onclick={() => api.dispatch({ type: 'eva.suitOff', crew: c.id })}>Take suit off</button>
          {:else}
            <button data-testid="suit-up" disabled={!c.suitAt} onclick={() => c.suitAt && api.dispatch({ type: 'eva.suitUp', crew: c.id, airlock: c.suitAt.id })}>
              {c.suitAt ? `Put suit on (${c.suitAt.free} at airlock)` : 'Put suit on (no free suit)'}
            </button>
          {/if}
        </div>
      {/if}
      <div class="btns one"><button class:on={c.fight?.engage ?? true} data-testid="engage" onclick={() => api.dispatch({ type: 'crew.setEngage', id: c.id, engage: !(c.fight?.engage ?? true) })}>Fire at will: {(c.fight?.engage ?? true) ? 'on' : 'off'}</button></div>
      <p class="hint">Right-click a tile to move, a hostile to attack, a console to man it, the shuttle to board. Drag a box to select several.</p>
    {/if}
  {/if}
</div>

<style>
  .top { display: grid; grid-template-columns: 64px 1fr; gap: 10px; margin-bottom: 10px; }
  .face { width: 64px; height: 68px; background: #061020; border: 1px solid var(--line); overflow: hidden; box-sizing: border-box; }
  .face img { display: block; width: 100%; height: 100%; image-rendering: pixelated; object-fit: cover; }
  .face.dead img { filter: grayscale(1) brightness(0.6); }
  .vitals { display: grid; gap: 2px; align-content: center; min-width: 0; }
  .v { display: grid; grid-template-columns: 18px 1fr 84px; gap: 8px; align-items: center; min-height: 22px; font-size: 13px; }
  .ic { display: inline-flex; color: var(--dim); }
  .n { text-align: right; white-space: nowrap; }
  .doing { display: flex; gap: 6px; align-items: center; margin: 0 0 10px; font-size: 13px; min-width: 0; }
  .doing > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .doing > span:last-child::first-letter { text-transform: uppercase; }
  .bad { color: #ff9a9a; }
  .orders { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 10px; }
  .orders button { display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--cyan); }
  .orders button span { color: var(--text); font: 600 13px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; }
  .btns { display: flex; gap: 4px; }
  .btns.one { display: grid; grid-template-columns: 1fr; margin-top: 8px; }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
  .chips :global(.kit-chips) { display: contents; }
  .warn { border-color: #7a2a2a; }
  .hint { margin: 6px 0 0; color: var(--dim); font-size: 11px; }
</style>
