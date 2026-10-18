<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCrew } from './api';

  let { api }: { api: UiApi } = $props();
  let crew = $state<UiCrew[]>([]);
  let sel = $state<number | null>(null);
  const ready = (c: UiCrew) => !c.dead && !c.downed && c.gridId !== 0;
  const allDrafted = $derived(crew.filter(ready).every((c) => c.drafted));

  onMount(() => {
    const a = api.crew.subscribe((c) => (crew = c));
    const b = api.selectedCrew.subscribe((s) => (sel = s));
    return () => (a(), b());
  });

  const draftAll = () => {
    for (const c of crew.filter(ready)) if (c.drafted === allDrafted) api.dispatch({ type: 'crew.draft', id: c.id, drafted: !allDrafted });
  };
  const status = (c: UiCrew) =>
    c.dead ? 'Dead' : c.downed ? 'Downed' : c.surrendered ? (c.prisoner ? 'Prisoner' : 'Surrendered') : c.inert ? 'Inert' : c.fight && c.fight.mode !== 'idle' ? (c.fight.mode === 'flee' ? 'Fleeing' : 'Fighting') : null;
  const line = (c: UiCrew) => (c.away || c.gridId === 0 ? c.where : (status(c) ?? (c.drafted ? 'Drafted' : c.job ? 'Working' : c.activity)));
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
<style>
  nav {
    position: fixed; left: 0; right: 0; top: calc(var(--hdr) + var(--sat)); display: flex; gap: 6px; overflow-x: auto;
    padding: 0 calc(8px + var(--sar)) 4px calc(8px + var(--sal)); pointer-events: none; scrollbar-width: none;
  }
  .chip { flex: none; display: grid; gap: 1px; width: 104px; padding: 3px 8px; text-align: left; line-height: 1.2; pointer-events: auto; background: var(--panel); min-height: 0; }
  .chip.all { width: auto; align-content: center; padding: 0 12px; }
  .chip.away { border-color: var(--amber); }
  .chip.bad { border-color: var(--red); }
  .name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .act { font-size: 11px; color: var(--dim); text-transform: capitalize; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .away .act { color: var(--amber); }
  .chip .bar { margin-top: 2px; }
  .bar.hurt > i { background: #ff9d3a; }
</style>
