<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCrew, UiShuttles } from '../api';
  import type { UiCrewDetail } from '../crewDetailApi';
  import Icon from '../Icon.svelte';
  import { Chips } from '../kit';
  import StatBar from '../inspector/StatBar.svelte';
  import TraitChips from '../inspector/TraitChips.svelte';
  import { moodWord } from './format';

  /** The crew Overview tab (and the whole view of a hostile): portrait, the vital bars, traits, skills in short, where and what, and the orders. */
  let { api, c, onPriorities }: { api: UiApi; c: UiCrew; d?: UiCrewDetail | null; onPriorities: () => void } = $props();
  const enemy = $derived(c.side === 'enemy');
  let shuttles = $state<UiShuttles>({ shuttles: [], airlocks: [], targets: [], roster: [], bays: [], regions: [], transfers: [], ferryReady: false });
  let rev = $state(0);
  const pic = $derived((void rev, api.portrait(c.id)));
  const skillName = (s: string) => s[0]!.toUpperCase() + s.slice(1);
  const airText = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  onMount(() => {
    const e = api.shuttles.subscribe((v) => (shuttles = v));
    // The portrait appears once its sprite sheets load.
    const t = setInterval(() => { if (!pic) rev++; }, 500);
    return () => (e(), clearInterval(t));
  });
</script>

<div data-testid="crew-overview">
  <div class="top">
  {#if pic}<span class="face" class:dead={c.dead}><img src={pic} alt="" /></span>{/if}
  <div class="meters">
    <StatBar icon="heart" title="Health" value={(c.hp / c.maxHp) * 100} color="var(--hp)" low={c.hp / c.maxHp < 0.4} text={c.dead ? 'dead' : `${c.hp}/${c.maxHp}`} testId="crew-health" />
    {#if c.suit}<StatBar icon="o2" title="Suit air" value={(c.suit.air / Math.max(1, c.suit.max)) * 100} low={c.suit.low} text="{c.suit.outside ? 'outside, ' : ''}{airText(c.suit.air)}{c.suit.low ? ' LOW' : ''}" testId="suit-air" />{/if}
    {#if !enemy}
      <StatBar icon="sleep" title="Rest" value={c.rest} color="var(--rest)" text="{c.rest}%" testId="crew-rest" />
      {#if c.hunger !== null}<StatBar icon="food" title="Hunger" value={c.hunger} color="var(--hunger)" low={c.hunger < 35} text={c.hunger <= 0 ? 'starving' : c.hunger < 35 ? 'hungry' : `${c.hunger}% fed`} testId="crew-hunger" />{/if}
      {#if c.mood}<StatBar icon="smile" title="Mood" value={c.mood.value} color="#b58cff" low={c.mood.value < 35} text="{c.mood.value} {moodWord(c.mood.value)}" testId="crew-mood" />{/if}
    {/if}
    {#if c.fight && c.fight.cooldown > 0}<StatBar size="sm" value={(c.fight.cooldown / Math.max(0.1, c.fight.cooldownMax)) * 100} color="var(--amber)" />{/if}
  </div>
  </div>
  {#if !enemy && c.traits.length}<div class="traits"><TraitChips traits={c.traits} testId="crew-traits" /></div>{/if}
  {#if !enemy && c.skills.length}
    <ul class="skills" data-testid="crew-skills">
      {#each c.skills as s (s.skill)}
        <li class:up={s.value > s.base} class:down={s.value < s.base} title={s.value === s.base ? `${skillName(s.skill)} ${s.value}: the role's level` : `${skillName(s.skill)} ${s.value} (role ${s.base})`} data-testid="skill-{s.skill}">
          <span>{skillName(s.skill)}</span><b>{s.value}</b>{#if s.value !== s.base}<em>{s.value > s.base ? '+' : '\u2212'}{Math.abs(s.value - s.base)}</em>{/if}
        </li>
      {/each}
    </ul>
  {/if}
  <dl>
    <dt>Where</dt><dd data-testid="crew-where">{c.where}</dd>
    <dt>Activity</dt><dd data-testid="crew-activity" class:plain={c.activity === 'knocked down'}>{c.drafted ? 'drafted' : c.activity}{c.job ? ` · ${c.job}` : ''}</dd>
    <dt>Weapon</dt><dd data-testid="crew-weapon">{c.weapon ? `${c.weapon.name} (${c.weapon.damage} dmg${c.weapon.ranged ? `, range ${c.weapon.range}` : ', melee'})` : 'bare hands'}</dd>
    {#if c.surrendered}<dt>Status</dt><dd class="bad">{c.prisoner ? 'prisoner' : 'surrendered'}</dd>{/if}
    {#if c.fight && c.fight.mode !== 'idle'}<dt>Fight</dt><dd data-testid="crew-fight">{c.fight.mode === 'flee' ? 'fleeing' : `${c.fight.ordered ? 'ordered on' : 'engaging'} ${c.fight.target ?? '...'}`}{c.fight.cover ? ` · ${c.fight.cover}` : ''}</dd>{/if}
    {#if c.downed}<dt>Bleeding out</dt><dd data-testid="crew-bleed" class="bad">{c.downed.stabilized ? 'stabilized' : `${c.downed.bleed}s`}</dd>{/if}
    {#if c.carriedBy}<dt>Carried by</dt><dd>{c.carriedBy}</dd>{/if}
    {#if c.carrying}<dt>Carrying</dt><dd>{c.carrying.count} {c.carrying.item.replace('item.', '')}</dd>{/if}
  </dl>
  {#if enemy}
    <div class="btns one"><button class="warn" data-testid="attack-hostile" disabled={c.dead || c.surrendered || !!c.downed} onclick={() => api.attack(c.id)}>Attack</button></div>
  {:else}
  <div class="btns">
    <button class="tile" class:on={c.drafted} title="{c.drafted ? 'Undraft' : 'Draft'} (R)" aria-label={c.drafted ? 'Undraft' : 'Draft'} data-testid="draft" onclick={() => api.dispatch({ type: 'crew.draft', id: c.id, drafted: !c.drafted })}><Icon name="draft" size={20} /></button>
    <button class="tile" title="Work priorities" aria-label="Priorities" data-testid="open-priorities" onclick={onPriorities}><Icon name="list" size={20} /></button>
  </div>
  {#if shuttles.regions.length > 1 && shuttles.regions.some((r) => r.id === c.ship) && !c.dead && !c.downed}
    <div class="sub">Base trip (by shuttle)</div>
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
  .traits { margin: 0 0 8px; }
  .meters { display: grid; gap: 4px; margin-bottom: 8px; }
  .top { display: flex; gap: 8px; align-items: stretch; }
  .top .meters { flex: 1; min-width: 0; }
  .face { flex: none; width: 48px; height: 51px; background: #061020; border: 1px solid var(--line); overflow: hidden; }
  .face img { display: block; width: 100%; height: 100%; image-rendering: pixelated; }
  .face.dead img { filter: grayscale(1) brightness(0.6); }
  .bad { color: #ff9a9a; }
  .skills { list-style: none; margin: 0 0 8px; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 1px 12px; font-size: 12px; }
  .skills li { display: flex; gap: 6px; align-items: baseline; color: var(--dim); }
  .skills li span { flex: 1; }
  .skills li b { color: var(--text); font-weight: 600; }
  .skills li em { font-style: normal; font-size: 11px; min-width: 18px; text-align: right; }
  .skills li.up em { color: #9fe0a8; } .skills li.down em { color: #ff9a9a; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; margin: 0 0 6px; }
  dt { color: var(--dim); } dd { margin: 0; text-align: right; text-transform: capitalize; } dd.plain { text-transform: none; } dd.plain::first-letter { text-transform: uppercase; }
  .btns { display: flex; gap: 4px; margin-top: 8px; }
  .btns.one { display: grid; grid-template-columns: 1fr; }
  .sub { color: var(--dim); font: 600 12px var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; margin: 8px 0 4px; }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .chips :global(.kit-chips) { display: contents; }
  .warn { border-color: #7a2a2a; }
  .hint { margin: 6px 0 0; color: var(--dim); font-size: 12px; }
</style>
