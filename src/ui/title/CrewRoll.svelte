<script lang="ts">
  import { onMount } from 'svelte';
  import type { StarterShip } from '../../content/ships/starterShips';
  import Icon from '../Icon.svelte';
  import { tip } from '../kit';
  import CrewCoverage from './CrewCoverage.svelte';
  import CrewDossier from './CrewDossier.svelte';
  import { interestMark, interestTip, topSkills } from './crewText';
  import type { TitleApi, UiCrewPlan, UiRollCrew } from './titleApi';

  /**
   * New game, step 2: roll the crew (mock C1, docs/TRAITS.md 10.12). The roster (left) lists the ship's berths with a lock and a reroll
   * die each, Reroll unlocked, then the ship's jobs and who covers them, Back and Start; the dossier (right) is the selected member in
   * full. Rolls are the sim's own
   * (`api.rollCrew`), keyed by seed, slot and reroll count, so stepping back through rolls is free and Start gets exactly
   * this crew.
   */
  let { api, ship, onBack }: { api: TitleApi; ship: StarterShip; onBack: () => void } = $props();
  // A crew screen opens on a fresh seed; the ship's roles set the slots.
  // svelte-ignore state_referenced_locally
  let plan = $state<UiCrewPlan>({ seed: api.newSeed(), ship: ship.id, picks: api.roles(ship.id).map((role) => ({ role, rerolls: 0 })) });
  let sel = $state(0);
  const crew = $derived<UiRollCrew[]>(api.rollCrew(plan));
  const cur = $derived(crew[sel] ?? crew[0]);
  /** Bumped while a portrait is still loading, so the faces ask again. */
  let rev = $state(0);
  const face = (c: UiRollCrew) => (void rev, api.portrait(c.look));
  onMount(() => {
    // Keep asking while a face is missing, and once more after the last one arrives so it is drawn.
    let waiting = true;
    const t = setInterval(() => {
      const missing = crew.some((c) => !api.portrait(c.look));
      if (missing || waiting) rev++;
      waiting = missing;
    }, 400);
    return () => clearInterval(t);
  });

  const setRolls = (slot: number, rerolls: number) => {
    plan.picks[slot] = { role: plan.picks[slot]!.role, rerolls: Math.max(0, rerolls) };
  };
  const reroll = (slot: number) => setRolls(slot, plan.picks[slot]!.rerolls + 1);
  /** Locked berths keep their roll through "Reroll unlocked" (screen state only: the plan holds the roll counts). */
  let locked = $state<boolean[]>([]);
  const toggleLock = (slot: number) => (locked[slot] = !locked[slot]);
  const rerollUnlocked = () => plan.picks.forEach((_p, i) => !locked[i] && setRolls(i, plan.picks[i]!.rerolls + 1));
  const jobs = $derived(api.shipJobs(ship.id));
  const rename = (slot: number, name: string) => {
    const p = plan.picks[slot]!;
    plan.picks[slot] = { ...p, ...(name.trim() ? { name: name.trim().slice(0, 24) } : { name: undefined }) };
  };
  const start = () => api.startGame($state.snapshot(plan));
</script>

<div class="pair" data-testid="title-crew">
  <section class="win roster">
    <div class="ph">New game: crew
      <span class="steps"><span class="done"><Icon name="check" size={14} />Ship</span><Icon name="chevRight" size={14} /><span class="cur">Crew</span></span>
    </div>
    <div class="ship"><span class="sn">{ship.title}</span><span class="sc">{ship.name} · {crew.length} crew</span></div>
    <div class="mid" data-testid="crew-roster-scroll">
    <ul>
      {#each crew as c (c.slot)}
        {@const pic = face(c)}
        <li class:on={c.slot === sel} data-testid="crew-slot">
          <div class="pick" role="button" tabindex="0" aria-label="Show {c.name}" onclick={() => (sel = c.slot)} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (sel = c.slot)}>
            <span class="face">{#if pic}<img src={pic} alt="" />{/if}</span>
            <span class="who">
              <span class="top"><span class="nm">{c.name}</span><span class="role">{c.title}</span></span>
              {#if c.background}<span class="bg">{c.background}</span>{/if}
              <span class="tops">{#each topSkills(c.skills) as s (s.skill)}<span>{s.name} <b>{s.value}</b>{#if s.interest}<i class="int" use:tip={{ text: interestTip(s.interest) }}>{interestMark(s.interest)}</i>{/if}</span>{/each}</span>
            </span>
          </div>
          <button class="ico lock" class:locked={locked[c.slot]} use:tip={{ text: locked[c.slot] ? `Unlock ${c.name}` : `Lock ${c.name}: keep them through Reroll unlocked` }} aria-label="{locked[c.slot] ? 'Unlock' : 'Lock'} {c.name}" aria-pressed={!!locked[c.slot]} data-testid="crew-lock-{c.slot}" onclick={() => toggleLock(c.slot)}><Icon name={locked[c.slot] ? 'lock' : 'unlock'} size={18} /></button>
          <button class="ico" use:tip={{ text: `Reroll ${c.name}` }} aria-label="Reroll {c.name}" data-testid="crew-reroll-{c.slot}" onclick={() => reroll(c.slot)}><Icon name="dice" size={20} /></button>
        </li>
      {/each}
    </ul>
    <div class="all">
      <button class="hd" data-testid="crew-reroll-all" onclick={rerollUnlocked}><Icon name="dice" size={18} />Reroll unlocked</button>
    </div>
    <CrewCoverage {crew} {jobs} />
    </div>
    <div class="foot">
      <button class="hd" data-testid="title-back" onclick={onBack}><Icon name="back" size={16} />Back</button>
      <button class="hd primary" data-testid="title-start" onclick={start}><Icon name="play" size={16} />Start</button>
    </div>
  </section>
  {#if cur}
    <CrewDossier c={cur} pic={face(cur)} onRename={(n) => rename(cur.slot, n)} onReroll={() => reroll(cur.slot)} onRoll={(r) => setRolls(cur.slot, r)} />
  {/if}
</div>

<style>
  /* 758px tall, centred; on a shorter window it keeps a 24px margin and the panels scroll inside. */
  .pair { position: fixed; inset: max(24px, calc((100vh - 758px) / 2)) 0; display: flex; justify-content: center; gap: 16px; pointer-events: none; }
  .pair > :global(*) { pointer-events: auto; }
  .win { display: flex; flex-direction: column; min-height: 0; background: rgba(11, 14, 17, 0.96); border: 1px solid var(--line-hi); }
  .roster { width: 440px; }
  .ph { display: flex; align-items: center; gap: 10px; min-height: 36px; margin: 0; padding: 0 12px; font-size: 15px; letter-spacing: 0.06em; }
  .steps { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; font: 600 13px var(--head-font); letter-spacing: 0.08em; color: var(--dim); }
  .steps .done { display: inline-flex; align-items: center; gap: 4px; color: var(--good-ink); }
  .steps .cur { color: #fff; border-bottom: 2px solid var(--cyan); padding-bottom: 1px; }
  .ph, .ship { flex: none; }
  .ship { display: flex; align-items: baseline; gap: 12px; padding: 12px; border-bottom: 1px solid var(--line); }
  .sn { font: 600 20px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; }
  .sc, .role { font: 600 13px var(--head-font); letter-spacing: 0.1em; text-transform: uppercase; }
  .sc { color: var(--dim); }
  .role { color: var(--cyan); }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: grid; grid-template-columns: 1fr 32px 32px; gap: 8px; align-items: center; padding: 10px 12px; border-bottom: 1px solid var(--line); }
  li.on { background: #0f1c24; box-shadow: inset 3px 0 0 var(--cyan); }
  .pick { display: grid; grid-template-columns: 56px 1fr; gap: 12px; align-items: center; cursor: pointer; }
  .face { width: 56px; height: 64px; background: var(--track); border: 1px solid var(--line); overflow: hidden; box-sizing: border-box; }
  .face img { display: block; width: 100%; height: 100%; image-rendering: pixelated; object-fit: cover; }
  .who { min-width: 0; }
  .top { display: flex; gap: 8px; align-items: center; }
  .nm { font: 600 18px var(--head-font); letter-spacing: 0.04em; color: var(--text); }
  .bg { display: block; margin-top: 2px; font-size: 13px; color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tops { display: flex; flex-wrap: wrap; gap: 2px 12px; margin-top: 3px; font-size: 13px; color: #c9ced3; }
  .tops b { color: #fff; font-weight: 700; }
  .int { font-style: normal; color: var(--amber); margin-left: 1px; cursor: help; }
  .lock { color: var(--dim); }
  .lock.locked { color: var(--amber); border-color: var(--amber); }
  .ico { width: 32px; height: 32px; min-width: 0; min-height: 0; padding: 0; display: inline-flex; align-items: center; justify-content: center; color: var(--cyan); }
  .ico:hover { border-color: var(--cyan); background: #12242e; }
  .all { display: grid; padding: 12px; }
  .hd { display: inline-flex; align-items: center; justify-content: center; gap: 8px; font: 600 14px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
  .primary { border-color: var(--cyan); color: #fff; background: #0c1a22; min-width: 180px; }
  /* The header and the Back / Start footer stay put; the list and the coverage scroll between them. */
  .mid { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
  .foot { flex: none; margin-top: auto; display: flex; justify-content: space-between; gap: 10px; padding: 12px; border-top: 1px solid var(--line); }
</style>
