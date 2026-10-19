<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCrew } from './api';

  let { api, onPriorities }: { api: UiApi; onPriorities: () => void } = $props();
  let crew = $state<UiCrew[]>([]);
  let foes = $state<UiCrew[]>([]);
  let sel = $state<number | null>(null);
  const c = $derived(crew.find((x) => x.id === sel) ?? foes.find((x) => x.id === sel));
  const enemy = $derived(c?.side === 'enemy');

  const moodWord = (v: number) => (v < 20 ? 'miserable' : v < 35 ? 'unhappy' : v < 65 ? 'content' : 'happy');
  const airText = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  onMount(() => {
    const a = api.crew.subscribe((v) => (crew = v));
    const b = api.selectedCrew.subscribe((s) => (sel = s));
    const d = api.hostiles.subscribe((v) => (foes = v));
    return () => (a(), b(), d());
  });
</script>

{#if c}
  <aside class="sheet" data-testid="crew-inspector">
    <h2 class:foe={enemy}>{c.name} <small>{c.role}{enemy ? ', hostile' : ''}</small></h2>
    <dl>
      <dt>Where</dt><dd data-testid="crew-where">{c.where}</dd>
      <dt>Weapon</dt><dd data-testid="crew-weapon">{c.weapon ? `${c.weapon.name} (${c.weapon.damage} dmg${c.weapon.ranged ? `, range ${c.weapon.range}` : ', melee'})` : 'bare hands'}</dd>
      {#if c.surrendered}<dt>Status</dt><dd class="bad">{c.prisoner ? 'prisoner' : 'surrendered'}</dd>{/if}
      {#if c.fight && c.fight.mode !== 'idle'}<dt>Fight</dt><dd data-testid="crew-fight">{c.fight.mode === 'flee' ? 'fleeing' : `${c.fight.ordered ? 'ordered on' : 'engaging'} ${c.fight.target ?? '...'}`}</dd>{/if}
      {#if c.fight && c.fight.cover}<dt>Cover</dt><dd>{c.fight.cover}</dd>{/if}
      <dt>Activity</dt><dd data-testid="crew-activity">{c.drafted ? 'drafted' : c.activity}</dd>
      <dt>Job</dt><dd>{c.job ?? 'none'}</dd>
      <dt>Health</dt><dd data-testid="crew-health">{c.dead ? 'dead' : `${c.hp}/${c.maxHp}`}</dd>
      {#if c.downed}<dt>Bleeding out</dt><dd data-testid="crew-bleed" class="bad">{c.downed.stabilized ? 'stabilized' : `${c.downed.bleed}s`}</dd>{/if}
      {#if c.carriedBy}<dt>Carried by</dt><dd>{c.carriedBy}</dd>{/if}
      {#if c.carrying}<dt>Carrying</dt><dd>{c.carrying.count} {c.carrying.item.replace('item.', '')}</dd>{/if}
      <dt>Rest</dt><dd>{c.rest}%</dd>
      {#if c.hunger !== null}<dt>Hunger</dt><dd data-testid="crew-hunger" class:bad={c.hunger < 35}>{c.hunger <= 0 ? 'starving' : c.hunger < 35 ? 'hungry' : `${c.hunger}% fed`}</dd>{/if}
      {#if c.mood}<dt>Mood</dt><dd data-testid="crew-mood" class:bad={c.mood.value < 35}>{c.mood.value} {moodWord(c.mood.value)}</dd>{/if}
      {#if c.suit}<dt>Suit air</dt><dd data-testid="suit-air" class:bad={c.suit.low}>{c.suit.outside ? 'outside, ' : ''}{airText(c.suit.air)}{c.suit.low ? ' LOW' : ''}</dd>{/if}
    </dl>
    {#if c.suit}<div class="bar air" class:low={c.suit.low} data-testid="suit-bar"><i style:width="{Math.round((c.suit.air / Math.max(1, c.suit.max)) * 100)}%"></i></div>{/if}
    <div class="bar hp" class:low={c.hp / c.maxHp < 0.4}><i style:width="{Math.round((c.hp / c.maxHp) * 100)}%"></i></div>
    {#if c.fight && c.fight.cooldown > 0}<div class="bar cd"><i style:width="{Math.round((c.fight.cooldown / Math.max(0.1, c.fight.cooldownMax)) * 100)}%"></i></div>{/if}
    {#if enemy}
      <div class="btns one"><button class="warn" data-testid="attack-hostile" disabled={c.dead || c.surrendered || !!c.downed} onclick={() => api.attack(c.id)}>Attack</button></div>
    {:else}
    <div class="bar rest" title="Rest"><i style:width="{c.rest}%"></i></div>
    {#if c.hunger !== null}<div class="bar food" class:low={c.hunger < 35} title="Hunger" data-testid="hunger-bar"><i style:width="{c.hunger}%"></i></div>{/if}
    {#if c.mood}
      <div class="bar mood" class:low={c.mood.value < 35} title="Mood" data-testid="mood-bar"><i style:width="{c.mood.value}%"></i></div>
      <ul class="why" data-testid="mood-reasons">
        {#each c.mood.factors as f (f.label)}<li class:neg={f.value < 0}><span>{f.label}</span><b>{f.value > 0 ? '+' : '\u2212'}{Math.abs(f.value)}</b></li>{/each}
        {#if c.mood.workMult < 1}<li class="neg"><span>Work speed</span><b>x{c.mood.workMult}</b></li>{/if}
      </ul>
    {/if}
    <div class="btns">
      <button class:on={c.drafted} data-testid="draft" onclick={() => api.dispatch({ type: 'crew.draft', id: c.id, drafted: !c.drafted })}>
        {c.drafted ? 'Undraft' : 'Draft'} (R)
      </button>
      <button data-testid="open-priorities" onclick={onPriorities}>Priorities</button>
    </div>
    {#if c.arms.length || c.weapon}
      <div class="sub">Weapon</div>
      <div class="chips" data-testid="equip-list">
        {#each c.arms as a (a.item)}
          <button class:on={c.weapon?.item === a.item} data-testid="equip-{a.item}" onclick={() => api.dispatch({ type: 'crew.equip', id: c.id, item: a.item })}>{a.name}<small>x{a.count}</small></button>
        {/each}
        {#if c.weapon}<button data-testid="unequip" onclick={() => api.dispatch({ type: 'crew.unequip', id: c.id })}>Drop {c.weapon.name}</button>{/if}
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
      <p class="hint">Tap a tile to move (any ship; crossing open space needs a suit), tap a hostile to attack.</p>
    {/if}
    {/if}
  </aside>
{/if}

<style>
  .bad { color: #ff9a9a; }
  .hp > i { background: #4cd964; } .hp.low > i { background: #ff5a2d; }
  .rest { margin-top: 4px; }
  .food { margin-top: 4px; } .food > i { background: #e0a23a; } .food.low > i { background: #ff5a2d; }
  .mood { margin-top: 4px; } .mood > i { background: #b58cff; } .mood.low > i { background: #ff5a2d; }
  .why { list-style: none; margin: 6px 0 0; padding: 0; font-size: 12px; display: grid; gap: 1px; }
  .why li { display: flex; justify-content: space-between; color: #9fe0a8; } .why li.neg { color: #ff9a9a; }
  .air { margin-top: 4px; } .air > i { background: var(--cyan); } .air.low > i { background: #ff5a2d; animation: blink 0.6s steps(2) infinite; }
  @keyframes blink { 50% { opacity: 0.35; } }
  aside { left: calc(8px + var(--sal)); bottom: calc(8px + var(--sab)); width: 280px; max-height: calc(100vh - var(--hdr) - 130px); overflow-y: auto; }
  h2 { margin: 0 0 6px; font-size: 15px; color: var(--cyan); }
  h2 small { color: var(--dim); font-weight: normal; margin-left: 6px; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; margin: 0 0 6px; }
  dt { color: var(--dim); } dd { margin: 0; text-align: right; text-transform: capitalize; }
  .btns { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 10px; }
  .foe { color: #ff8a7a; }
  .cd > i { background: var(--amber); }
  .sub { color: var(--dim); font-size: 12px; margin: 8px 0 4px; }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .chips button { min-height: 34px; padding: 0 10px; display: flex; gap: 6px; align-items: center; }
  .chips small { color: var(--dim); }
  .btns.one { grid-template-columns: 1fr; }
  .warn { border-color: #7a2a2a; }
  .hint { margin: 6px 0 0; color: var(--dim); font-size: 12px; }
  @media (max-width: 600px) { aside { width: auto; left: 0; bottom: 0; max-height: 52vh; } }
</style>
