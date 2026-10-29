<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCrew } from './api';
  import Icon, { type IconName } from './Icon.svelte';

  /** `compact`: small portraits only (the combat view). */
  let { api, compact = false }: { api: UiApi; compact?: boolean } = $props();
  let crew = $state<UiCrew[]>([]);
  let sel = $state<number | null>(null);
  const ready = (c: UiCrew) => !c.dead && !c.downed && c.ship !== 0;
  const allDrafted = $derived(crew.filter(ready).every((c) => c.drafted));

  /** Bumped while some portrait is still waiting for its sheets, so the cards ask again. */
  let rev = $state(0);
  const portrait = (c: UiCrew): string | null => (void rev, api.portrait(c.id));

  onMount(() => {
    // Re-render the cards when a portrait appears (or changes) since the last poll, and keep polling while some are missing.
    let seen = '';
    const poll = setInterval(() => {
      const have = crew.map((c) => (api.portrait(c.id) ? c.id : -1)).join(',');
      if (have !== seen) { seen = have; rev++; }
    }, 500);
    const a = api.crew.subscribe((c) => (crew = c.filter((m) => !m.mechanical)));
    const b = api.selectedCrew.subscribe((s) => (sel = s));
    return () => (a(), b(), clearInterval(poll));
  });

  const draftAll = () => {
    for (const c of crew.filter(ready)) if (c.drafted === allDrafted) api.dispatch({ type: 'crew.draft', id: c.id, drafted: !allDrafted });
  };
  /** What the crew member is doing, as one status icon and a tooltip. */
  function status(c: UiCrew): { icon: IconName; label: string; tone: 'ok' | 'warn' | 'bad' | 'dim' } {
    if (c.dead) return { icon: 'skull', label: 'Dead', tone: 'bad' };
    if (c.downed) return { icon: 'downed', label: c.downed.stabilized ? 'Downed (stable)' : 'Downed', tone: 'bad' };
    if (c.away || c.ship === 0) return { icon: 'away', label: c.where, tone: 'warn' };
    if (c.activity === 'knocked down') return { icon: 'downed', label: 'Knocked down', tone: 'bad' };
    if (c.fight && c.fight.mode !== 'idle') return { icon: 'target', label: c.fight.mode === 'flee' ? 'Fleeing' : 'Fighting', tone: 'bad' };
    if (c.drafted) return { icon: 'draft', label: 'Drafted', tone: 'warn' };
    if (c.hunger !== null && c.hunger < 10) return { icon: 'food', label: 'Starving', tone: 'bad' };
    switch (c.activity) {
      case 'sleeping': return { icon: 'sleep', label: 'Sleeping', tone: 'dim' };
      case 'eating': return { icon: 'food', label: 'Eating', tone: 'ok' };
      case 'charging': return { icon: 'bolt', label: 'Charging', tone: 'ok' };
      case 'working': return { icon: 'wrench', label: c.job ?? 'Working', tone: 'ok' };
      case 'walking': return { icon: c.job ? 'wrench' : 'walk', label: c.job ?? 'Walking', tone: 'ok' };
      default: return { icon: 'idle', label: 'Idle', tone: 'dim' };
    }
  }
  const pct = (v: number) => `${Math.max(0, Math.min(100, Math.round(v)))}%`;
  /** Needs attention: hungry, badly hurt, or down. */
  const trouble = (c: UiCrew) => !c.dead && (c.downed !== null || (c.hunger !== null && c.hunger < 35) || c.hp < c.maxHp * 0.5);
</script>

<nav data-testid="crewbar" class:compact>
  {#each crew as c (c.id)}
    {@const s = status(c)}
    {@const pic = portrait(c)}
    <button class="card" class:on={sel === c.id} class:warn={trouble(c)} class:bad={c.downed || c.dead} title="{c.name} · {s.label}" data-testid="crew-chip" onclick={() => api.selectCrew(c.id, true)}>
      <span class="face" class:dead={c.dead} class:down={!!c.downed && !c.dead}>{#if pic}<img src={pic} alt="" />{/if}</span>
      <span class="st {s.tone}"><Icon name={s.icon} size={12} /></span>
      <span class="name">{c.name}</span>
      <span class="role">{c.role}</span>
      <span class="bars">
        <i class="hp"><b style:width={pct((c.hp / c.maxHp) * 100)}></b></i>
        <i class="rest"><b style:width={pct(c.rest)}></b></i>
        {#if c.hunger !== null}<i class="hunger"><b style:width={pct(c.hunger)}></b></i>{/if}
      </span>
      <span class="sr" data-testid="crew-line">{s.label}</span>
    </button>
  {/each}
  <button class="tile all" class:on={allDrafted && crew.length > 0} title={allDrafted ? 'Stand down' : 'Draft all'} aria-label={allDrafted ? 'Stand down' : 'Draft all'} data-testid="draft-all" onclick={draftAll}><Icon name="draft" size={20} /></button>
</nav>

<style>
  nav { display: flex; gap: 3px; align-items: stretch; min-width: 0; overflow-x: auto; scrollbar-width: none; }
  .card {
    --face: 58px; position: relative; flex: none; width: calc(var(--face) + 84px); height: calc(var(--face) * 1.0689 + 26px); padding: 5px 6px 5px 5px; min-height: 0;
    display: grid; grid-template-columns: var(--face) 1fr; grid-template-rows: auto auto 1fr; column-gap: 5px; align-content: start;
    text-align: left; background: var(--panel);
  }
  .card.warn { border-color: var(--amber); }
  .card.bad { border-color: var(--red); }
  .card.on { border-color: var(--cyan); box-shadow: inset 0 0 0 1px var(--cyan); }
  /* The portrait: a crop of the real crew sprite in whole art px (16 x 18), shown at a whole multiple (2x) with hard edges. */
  .face { grid-row: 1 / 3; width: var(--face); height: calc(var(--face) * 1.0689); background: #061020; overflow: hidden; }
  .face img { display: block; width: 100%; height: 100%; image-rendering: pixelated; }
  .face.dead img { filter: grayscale(1) brightness(0.6); }
  .face.down img { filter: saturate(0.6) brightness(0.75) sepia(1) hue-rotate(-45deg) saturate(2.2); }
  .st { position: absolute; left: calc(var(--face) - 6px); top: calc(var(--face) * 1.0689 - 5px); display: grid; place-items: center; padding: 1px; background: var(--panel); border-radius: 50%; }
  .st.ok { color: var(--green); } .st.warn { color: var(--amber); } .st.bad { color: var(--red); } .st.dim { color: var(--dim); }
  .name { font: 600 14px/1.1 var(--head-font); color: var(--cyan); letter-spacing: 0.02em; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .role { font: 10px/1.2 var(--head-font); color: var(--dim); text-transform: uppercase; letter-spacing: 0.05em; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bars { grid-column: 1 / 3; align-self: end; display: grid; gap: 2px; width: 100%; }
  .bars i { display: block; height: 3px; background: #061020; }
  .bars b { display: block; height: 100%; }
  .hp b { background: var(--hp); } .rest b { background: var(--rest); } .hunger b { background: var(--hunger); }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  nav.compact .card { --face: 30px; width: calc(var(--face) + 10px); height: auto; padding: 3px; display: block; }
  nav.compact .name, nav.compact .role, nav.compact .bars { display: none; }
  nav.compact .card .st { left: calc(var(--face) - 4px); top: calc(var(--face) * 1.0689 - 6px); }
  nav.compact .all { width: 30px; }
  .all { height: auto; align-self: stretch; }
  @media (max-width: 600px) { .card { width: calc(var(--face) + 56px); padding: 4px; } .name { font-size: 12px; } .role { display: none; } }
</style>
