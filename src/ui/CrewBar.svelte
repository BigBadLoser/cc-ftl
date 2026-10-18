<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCrew } from './api';

  let { api }: { api: UiApi } = $props();
  let crew = $state<UiCrew[]>([]);
  let foes = $state<UiCrew[]>([]);
  let sel = $state<number | null>(null);
  const selDrafted = $derived(crew.some((c) => c.id === sel && c.drafted));
  const ready = (c: UiCrew) => !c.dead && !c.downed && c.gridId !== 0;
  const allDrafted = $derived(crew.filter(ready).every((c) => c.drafted));

  onMount(() => {
    const a = api.crew.subscribe((c) => (crew = c));
    const b = api.selectedCrew.subscribe((s) => (sel = s));
    const d = api.hostiles.subscribe((h) => (foes = h));
    return () => (a(), b(), d());
  });

  // Alerts sit under the crew rows: tell them how much room the hostile row takes.
  $effect(() => {
    document.documentElement.style.setProperty('--foes', foes.length ? '56px' : '0px');
  });
  const draftAll = () => {
    for (const c of crew.filter(ready)) if (c.drafted === allDrafted) api.dispatch({ type: 'crew.draft', id: c.id, drafted: !allDrafted });
  };
  const status = (c: UiCrew) =>
    c.dead ? 'Dead' : c.downed ? 'Downed' : c.surrendered ? (c.prisoner ? 'Prisoner' : 'Surrendered') : c.inert ? 'Inert' : c.fight && c.fight.mode !== 'idle' ? (c.fight.mode === 'flee' ? 'Fleeing' : 'Fighting') : null;
  const line = (c: UiCrew) => (c.away || c.gridId === 0 ? c.where : (status(c) ?? (c.drafted ? 'Drafted' : c.job ? 'Working' : c.activity)));
  const foeClick = (c: UiCrew) => (selDrafted ? api.attack(c.id) : api.selectCrew(c.id, true));
</script>

<nav data-testid="crewbar">
  {#each crew as c (c.id)}
    <button class="chip" class:on={sel === c.id} class:away={c.away} class:bad={c.downed || c.dead} data-testid="crew-chip" onclick={() => api.selectCrew(c.id, true)}>
      <span class="name">{c.name}</span>
      <span class="act" data-testid="crew-line">{line(c)}</span>
      <span class="bar" class:hurt={c.hp < c.maxHp}><i style:width="{c.hp < c.maxHp ? Math.round((c.hp / c.maxHp) * 100) : c.rest}%"></i></span>
    </button>
  {/each}
  <button class="chip all" class:on={allDrafted && crew.length > 0} data-testid="draft-all" onclick={draftAll}>{allDrafted ? 'Stand down' : 'Draft all'}</button>
</nav>
{#if foes.length}
  <nav class="foes" data-testid="hostile-bar" aria-label="Hostiles">
    {#each foes as c (c.id)}
      <button class="chip foe" class:on={sel === c.id} class:out={c.downed || c.surrendered} data-testid="hostile-chip" onclick={() => foeClick(c)} title={selDrafted ? 'Attack' : 'Inspect'}>
        <span class="name">{c.name}</span>
        <span class="act">{status(c) ?? c.role}</span>
        <span class="bar"><i style:width="{Math.round((c.hp / Math.max(1, c.maxHp)) * 100)}%"></i></span>
      </button>
    {/each}
  </nav>
{/if}

<style>
  nav {
    position: fixed; left: 0; right: 0; top: calc(var(--hdr) + var(--sat)); display: flex; gap: 6px; overflow-x: auto;
    padding: 0 calc(8px + var(--sar)) 4px calc(8px + var(--sal)); pointer-events: none; scrollbar-width: none;
  }
  nav.foes { top: calc(var(--hdr) + var(--sat) + 56px); }
  .chip { flex: none; display: grid; gap: 1px; width: 104px; padding: 3px 8px; text-align: left; line-height: 1.2; pointer-events: auto; background: var(--panel); min-height: 0; }
  .chip.all { width: auto; align-content: center; padding: 0 12px; }
  .chip.away { border-color: var(--amber); }
  .chip.bad { border-color: var(--red); }
  .chip.foe { border-color: #7a2a2a; }
  .chip.foe .bar > i { background: #ff5a4a; }
  .chip.foe.out { opacity: 0.7; }
  .name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .act { font-size: 11px; color: var(--dim); text-transform: capitalize; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .away .act { color: var(--amber); }
  .chip .bar { margin-top: 2px; }
  .bar.hurt > i { background: #ff9d3a; }
</style>
