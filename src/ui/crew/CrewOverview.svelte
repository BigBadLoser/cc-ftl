<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCrew, UiShuttles } from '../api';
  import type { UiCrewDetail } from '../crewDetailApi';
  import Icon from '../Icon.svelte';
  import { Chip, Chips, tip } from '../kit';
  import ItemCard from '../inspector/ItemCard.svelte';
  import StatBar from '../inspector/StatBar.svelte';
  import TraitChips from '../inspector/TraitChips.svelte';
  import { attackBlocked, crewState, moodWord } from './format';
  import { healthTone } from '../inspector/health';

  /**
   * The crew Overview tab (and the whole view of a hostile): portrait, health and mood, what they are doing, the trait chips,
   * and the orders. Everything else is in the tabs.
   */
  let { api, c, d, onPriorities }: { api: UiApi; c: UiCrew; d?: UiCrewDetail | null; onPriorities: () => void } = $props();
  /** The wielded weapon's stats card (from the detail snapshot, built for the inspected crew member of either side). */
  const wcard = $derived(d?.gear.find((g) => g.slot === 'weapon')?.item?.card ?? null);
  const enemy = $derived(c.side === 'enemy');
  let shuttles = $state<UiShuttles>({ shuttles: [], airlocks: [], targets: [], roster: [], bays: [], regions: [], transfers: [], ferryReady: false });
  let rev = $state(0);
  const pic = $derived((void rev, api.portrait(c.id)));
  const now = $derived(crewState(c));
  const blocked = $derived(attackBlocked(c));

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
      <div class="v" use:tip={{ text: 'Health' }} data-testid="crew-health"><span class="ic"><Icon name="heart" size={16} /></span><StatBar value={(c.hp / c.maxHp) * 100} health /><span class="n {healthTone(c.hp / c.maxHp)}">{c.dead ? 'dead' : `${c.hp}/${c.maxHp}`}</span></div>
      {#if c.mood && !enemy}<div class="v" use:tip={{ text: 'Mood' }} data-testid="crew-mood"><span class="ic"><Icon name="smile" size={16} /></span><StatBar value={c.mood.value} color="#b58cff" low={c.mood.value < 35} /><span class="n">{c.mood.value} {moodWord(c.mood.value)}{#if c.mood.strain}<span class="strain" use:tip={{ text: `Under strain (${c.mood.strain}): a break can come at any mood` }} data-testid="crew-strain">, strained</span>{/if}</span></div>{/if}
      {#if c.hunger !== null && !enemy}<div class="v" use:tip={{ text: 'Hunger' }} data-testid="crew-hunger"><span class="ic"><Icon name="food" size={16} /></span><StatBar value={c.hunger} color="var(--hunger)" low={c.hunger < 35} /><span class="n" class:bad={c.hunger < 35}>{c.hunger <= 0 ? 'starving' : `${c.hunger}% fed`}</span></div>{/if}
      {#if !enemy}<div class="v" use:tip={{ text: 'Rest' }} data-testid="crew-rest"><span class="ic"><Icon name="sleep" size={16} /></span><StatBar value={c.rest} color="var(--rest)" low={c.rest < 10} /><span class="n" class:bad={c.rest < 10}>{c.rest}% rest</span></div>{/if}
    </div>
  </div>
  <p class="doing" class:bad={now.bad} data-testid="crew-activity">{#if now.chip}<Chip tone="bad" testId="crew-state">{now.chip}</Chip>{:else}<span class="ic"><Icon name="wrench" size={14} /></span>{/if}<span title={now.text}>{now.text}</span></p>
  {#if c.weapon}
    {#snippet card()}{#if wcard}<ItemCard card={wcard} />{/if}{/snippet}
    <div class="weapon" data-testid="crew-weapon">
      <span class="wl" use:tip={{ text: `${c.weapon.name}: ${c.weapon.damage} damage, ${c.weapon.ranged ? `range ${c.weapon.range}` : 'melee'}`, rich: wcard ? card : undefined, side: 'right', focus: true }}><span class="ic"><Icon name={c.weapon.ranged ? 'target' : 'sword'} size={14} /></span><b>{c.weapon.name}</b><span class="dim">{c.weapon.ranged ? 'ranged' : 'melee'} · {c.weapon.damage} dmg{c.weapon.ranged ? ` · ${c.weapon.range} tiles` : ''}</span></span>
    </div>
  {/if}
  {#if !enemy && d && (d.bonds.friends.length || d.bonds.rivals.length)}
    <div class="bonds" data-testid="crew-bonds">
      {#each [['Friends', d.bonds.friends, 'friend'], ['Rivals', d.bonds.rivals, 'rival']] as const as [label, list, kind] (kind)}
        {#if list.length}
          <p class={kind} data-testid="crew-{kind}s"><span class="k">{label}</span>
            {#each list as b, i (b.id || b.name)}<span class="who" use:tip={{ text: `${b.name}: ${b.line}`, side: 'bottom', focus: true }} data-testid="bond-{kind}">{b.name}{i < list.length - 1 ? ',' : ''}</span>{/each}</p>
        {/if}
      {/each}
    </div>
  {/if}
  {#if !enemy && c.traits.length}<div class="traits"><TraitChips traits={c.traits} small fit={278} testId="crew-traits" /></div>{/if}
  {#if enemy}
    <div class="btns one"><button class="warn" data-testid="attack-hostile" disabled={!!blocked} use:tip={{ text: blocked ?? 'Order the selected drafted crew to attack' }} onclick={() => api.attack(c.id)}>Attack</button></div>
  {:else if c.side === 'visitor' && c.visit === 'Inspector'}
    <!-- Attacking an inspector is a choice with a price: their faction turns hostile and the ship that sent them fights (#138 step 3). -->
    <div class="btns one"><button class="warn" data-testid="attack-inspector" disabled={!!blocked} use:tip={{ text: blocked ?? 'Order the selected drafted crew to attack. Their faction turns hostile (a big standing loss), and the ship that sent them fights back.' }} onclick={() => api.attack(c.id)}>Attack</button></div>
  {:else if c.side === 'player'}
    <!-- (A passenger takes no orders: no draft, no priorities, no trips.) -->
    <div class="orders">
      <button class:on={c.drafted} use:tip={{ text: `${c.drafted ? 'Undraft' : 'Draft'}`, key: 'crew.draft' }} data-testid="draft" onclick={() => api.dispatch({ type: 'crew.draft', id: c.id, drafted: !c.drafted })}><Icon name="draft" size={18} /><span>{c.drafted ? 'Undraft' : 'Draft'}</span></button>
      <button use:tip={{ text: 'Work priorities' }} data-testid="open-priorities" onclick={onPriorities}><Icon name="list" size={18} /><span>Priorities</span></button>
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
              {c.suitAt ? 'Put suit on' : 'Put suit on (no airlock)'}
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
  .face { width: 64px; height: 68px; background: var(--track); border: 1px solid var(--line); overflow: hidden; box-sizing: border-box; }
  .face img { display: block; width: 100%; height: 100%; image-rendering: pixelated; object-fit: cover; }
  .face.dead img { filter: grayscale(1) brightness(0.6); }
  .vitals { display: grid; gap: 0; align-content: center; min-width: 0; }
  .v { display: grid; grid-template-columns: 18px 1fr 84px; gap: 8px; align-items: center; min-height: 18px; font-size: 13px; }
  .n.good { color: var(--text); } .n.warn { color: var(--amber); } .n.bad { color: var(--red); }
  .ic { display: inline-flex; color: var(--dim); }
  .n { text-align: right; white-space: nowrap; }
  .strain { color: var(--amber); }
  .doing { display: flex; gap: 6px; align-items: center; margin: 0 0 10px; font-size: 13px; min-width: 0; }
  .doing > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .doing > span:last-child::first-letter { text-transform: uppercase; }
  .bad { color: var(--red); }
  .bonds { margin: 0 0 10px; display: grid; gap: 2px; font-size: 13px; }
  .bonds p { margin: 0; display: flex; flex-wrap: wrap; gap: 0 6px; align-items: baseline; }
  .bonds .k { color: var(--dim); font: 600 11px var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; min-width: 52px; }
  .bonds .friend .who { color: var(--green); }
  .bonds .rival .who { color: var(--red); }
  .weapon { margin: -4px 0 10px; }
  .wl { display: flex; gap: 6px; align-items: center; font-size: 13px; white-space: nowrap; overflow: hidden; }
  .wl b { font-weight: 400; }
  .dim { color: var(--dim); font-size: 12px; }
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
