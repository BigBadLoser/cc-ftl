<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCrew, UiShuttles } from './api';
  import Icon, { type IconName } from './Icon.svelte';
  import PanelHead from './PanelHead.svelte';
  import { Chips } from './kit';

  let { api, onPriorities, onBack }: { api: UiApi; onPriorities: () => void; onBack: () => void } = $props();
  let crew = $state<UiCrew[]>([]);
  let foes = $state<UiCrew[]>([]);
  let sel = $state<number | null>(null);
  let shuttles = $state<UiShuttles>({ shuttles: [], airlocks: [], targets: [], roster: [], bays: [], regions: [], ferryReady: false });
  const c = $derived(crew.find((x) => x.id === sel) ?? foes.find((x) => x.id === sel));
  const enemy = $derived(c?.side === 'enemy');

  const moodWord = (v: number) => (v < 20 ? 'miserable' : v < 35 ? 'unhappy' : v < 65 ? 'content' : 'happy');
  const airText = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  onMount(() => {
    const a = api.crew.subscribe((v) => (crew = v));
    const b = api.selectedCrew.subscribe((s) => (sel = s));
    const d = api.hostiles.subscribe((v) => (foes = v));
    const e = api.shuttles.subscribe((v) => (shuttles = v));
    return () => (a(), b(), d(), e());
  });
</script>

{#snippet meter(icon: IconName, label: string, pct: number, cls: string, low: boolean, text: string, tid: string, barTid?: string)}
  <div class="m {cls}" class:low title={label} data-testid={barTid}>
    <Icon name={icon} size={16} />
    <span class="bar"><i style:width="{Math.max(0, Math.min(100, Math.round(pct)))}%"></i></span>
    <span class="mv" data-testid={tid}>{text}</span>
  </div>
{/snippet}

{#if c}
  <div data-testid="crew-inspector">
    <PanelHead icon={enemy ? 'skull' : 'person'} title={c.name} sub="{c.role}{enemy ? ' · hostile' : ''}" foe={enemy} {onBack} />
    <div class="meters">
      {@render meter('heart', 'Health', (c.hp / c.maxHp) * 100, 'hp', c.hp / c.maxHp < 0.4, c.dead ? 'dead' : `${c.hp}/${c.maxHp}`, 'crew-health')}
      {#if c.suit}{@render meter('o2', 'Suit air', (c.suit.air / Math.max(1, c.suit.max)) * 100, 'air', c.suit.low, `${c.suit.outside ? 'outside, ' : ''}${airText(c.suit.air)}${c.suit.low ? ' LOW' : ''}`, 'suit-air', 'suit-bar')}{/if}
      {#if !enemy}
        {@render meter('sleep', 'Rest', c.rest, 'rest', false, `${c.rest}%`, 'crew-rest')}
        {#if c.hunger !== null}{@render meter('food', 'Hunger', c.hunger, 'food', c.hunger < 35, c.hunger <= 0 ? 'starving' : c.hunger < 35 ? 'hungry' : `${c.hunger}% fed`, 'crew-hunger', 'hunger-bar')}{/if}
        {#if c.mood}{@render meter('smile', 'Mood', c.mood.value, 'mood', c.mood.value < 35, `${c.mood.value} ${moodWord(c.mood.value)}`, 'crew-mood', 'mood-bar')}{/if}
      {/if}
      {#if c.fight && c.fight.cooldown > 0}<div class="bar cd"><i style:width="{Math.round((c.fight.cooldown / Math.max(0.1, c.fight.cooldownMax)) * 100)}%"></i></div>{/if}
    </div>
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
    {#if c.mood && (c.mood.factors.length || c.mood.workMult < 1)}
      <details class="why-box">
        <summary>Mood details</summary>
        <ul class="why" data-testid="mood-reasons">
          {#each c.mood.factors as f (f.label)}<li class:neg={f.value < 0}><span>{f.label}</span><b>{f.value > 0 ? '+' : '\u2212'}{Math.abs(f.value)}</b></li>{/each}
          {#if c.mood.workMult < 1}<li class="neg"><span>Work speed</span><b>x{c.mood.workMult}</b></li>{/if}
        </ul>
      </details>
    {/if}
    <div class="btns">
      <button class="tile" class:on={c.drafted} title="{c.drafted ? 'Undraft' : 'Draft'} (R)" aria-label={c.drafted ? 'Undraft' : 'Draft'} data-testid="draft" onclick={() => api.dispatch({ type: 'crew.draft', id: c.id, drafted: !c.drafted })}><Icon name="draft" size={20} /></button>
      <button class="tile" title="Work priorities" aria-label="Priorities" data-testid="open-priorities" onclick={onPriorities}><Icon name="list" size={20} /></button>
    </div>
    {#if c.arms.length || c.weapon}
      <div class="sub">Weapon</div>
      <div class="chips" data-testid="equip-list">
        <Chips label="Weapon" deselect={false} value={c.weapon?.item ?? ''} options={c.arms.map((a) => ({ value: a.item, label: a.name, sub: `x${a.count}`, testId: `equip-${a.item}` }))} onChange={(item: string) => api.dispatch({ type: 'crew.equip', id: c.id, item })} />
        {#if c.weapon}<button data-testid="unequip" onclick={() => api.dispatch({ type: 'crew.unequip', id: c.id })}>Drop {c.weapon.name}</button>{/if}
      </div>
    {/if}
    {#if shuttles.regions.length > 1 && shuttles.regions.some((r) => r.id === c.ship) && !c.dead && !c.downed}
      <div class="sub">Base trip (by shuttle)</div>
      <div class="chips" data-testid="ferry-crew">
        {#each shuttles.regions.filter((r) => r.id !== c.ship) as r (r.id)}
          <button disabled={!shuttles.ferryReady} data-testid="ferry-crew-{r.id}" title={shuttles.ferryReady ? '' : 'No free shuttle'} onclick={() => api.dispatch({ type: 'ferry.order', from: c.ship, to: r.id, crew: [c.id] })}>
            {r.home ? 'Come home' : `Go to ${r.name}`}
          </button>
        {/each}
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
  </div>
{/if}

<style>
  .bad { color: #ff9a9a; }
  .meters { display: grid; gap: 4px; margin-bottom: 8px; }
  .m { display: grid; grid-template-columns: 16px 1fr auto; align-items: center; gap: 8px; color: var(--dim); }
  .mv { min-width: 74px; text-align: right; color: var(--text); font-size: 12px; text-transform: capitalize; }
  .m.hp > .bar > i, .m.hp { --c: var(--hp); } .m.rest { --c: var(--rest); } .m.food { --c: var(--hunger); } .m.mood { --c: #b58cff; } .m.air { --c: var(--cyan); }
  .m > .bar > i { background: var(--c); }
  .m.low > .bar > i { background: #ff5a2d; }
  .m.air.low > .bar > i { animation: blink 0.6s steps(2) infinite; }
  .m.low .mv { color: #ff9a9a; }
  @keyframes blink { 50% { opacity: 0.35; } }
  .m .bar { height: 8px; }
  .cd > i { background: var(--amber); }
  .why-box { margin: 0 0 6px; font-size: 12px; color: var(--dim); }
  .why-box summary { cursor: pointer; }
  .why { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 1px; }
  .why li { display: flex; justify-content: space-between; color: #9fe0a8; } .why li.neg { color: #ff9a9a; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; margin: 0 0 6px; }
  dt { color: var(--dim); } dd { margin: 0; text-align: right; text-transform: capitalize; } dd.plain { text-transform: none; } dd.plain::first-letter { text-transform: uppercase; }
  .btns { display: flex; gap: 4px; margin-top: 8px; }
  .btns.one { display: grid; grid-template-columns: 1fr; }
  .sub { color: var(--dim); font: 600 12px var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; margin: 8px 0 4px; }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .chips :global(.kit-chips) { display: contents; }
  .chips > button { min-height: 34px; padding: 0 10px; }
  .warn { border-color: #7a2a2a; }
  .hint { margin: 6px 0 0; color: var(--dim); font-size: 12px; }
</style>
