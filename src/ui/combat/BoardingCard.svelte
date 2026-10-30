<script lang="ts">
  import { Frame, Meter, Pill } from '../kit';
  import type { UiApi, UiBoarding } from '../api';

  /**
   * The boarding party on the enemy ship under the enemy card: who is aboard, the sabotage under way (with the module's health),
   * Recall, and the two warnings: friendly fire (your aim lands where your crew stand) and a jump that would leave crew behind.
   * Boarders are ordered with a right-click on an enemy module ("Sabotage ..."), see app/crewOrders.ts.
   */
  let { api, b }: { api: UiApi; b: UiBoarding } = $props();
  const STATE = { sabotage: 'wrecking', paused: 'fighting', fighting: 'fighting', holding: 'ready', returning: 'returning', down: 'down' } as const;
  const TONE = { sabotage: 'green', paused: 'amber', fighting: 'amber', holding: 'dim', returning: 'cyan', down: 'red' } as const;
  const hpFill = (v: number) => (v < 0.3 ? 'var(--health-bad)' : v < 0.6 ? 'var(--health-warn)' : 'var(--health-good)');
  const recallIds = $derived(b.party.filter((p) => p.state !== 'returning' && p.state !== 'down').map((p) => p.id));
  const leaves = $derived([...b.jump.crew, ...b.jump.vehicles]);
</script>

<Frame title="Boarding party" style="width:290px; pointer-events:auto; background: var(--panel)" testid="boarding-card">
  {#snippet right()}
    <Pill tone="cyan">{b.party.length} aboard</Pill>
  {/snippet}
  <div class="body">
    {#if b.fireOn.length}
      <div class="warn red" data-testid="friendly-fire" role="alert">
        <b>Friendly fire</b>
        {#each b.fireOn as f, i (i)}
          <span>{f.by} aimed at the {f.at}, where {f.crew.join(', ')} {f.crew.length === 1 ? 'stands' : 'stand'}</span>
        {/each}
      </div>
    {/if}
    <ul class="party">
      {#each b.party as p (p.id)}
        <li data-state={p.state}>
          <button class="nm" title="Select {p.name}" onclick={() => api.selectCrew(p.id)}>{p.name}</button>
          <Meter value={p.hp} fill={hpFill(p.hp)} height={6} />
          <span class="st {TONE[p.state]}">{STATE[p.state]}</span>
        </li>
      {/each}
    </ul>
    {#each b.sabotage as s (s.module)}
      <div class="sab" data-testid="sabotage-row" data-state={s.state}>
        <div class="line">
          <b>{s.name}</b>
          <Pill tone={s.state === 'active' ? 'green' : 'amber'}>{s.state === 'active' ? 'Sabotage active' : 'Sabotage paused'}</Pill>
        </div>
        <Meter value={s.hp / Math.max(1, s.maxHp)} fill={hpFill(s.hp / Math.max(1, s.maxHp))} height={14} edge="var(--hostile-track)" label="{s.hp}/{s.maxHp}" title="Module health" />
        <div class="line">
          <span class="dim">{s.state === 'paused' ? 'Resumes after the fight: ' : ''}{s.crew.join(', ')}</span>
          <button class="act" data-testid="sabotage-cancel" onclick={() => api.dispatch({ type: 'crew.cancelSabotage', ids: s.crewIds })}>Cancel</button>
        </div>
      </div>
    {:else}
      <p class="hint">Select boarders and right-click an enemy module to sabotage it.</p>
    {/each}
    {#if leaves.length}
      <div class="warn amber" data-testid="jump-warning">Jumping now leaves behind: {leaves.join(', ')}</div>
    {/if}
    <button class="go" data-testid="boarding-recall" disabled={!b.canRecall || recallIds.length === 0} title={b.canRecall ? 'Walk the party back to the shuttle and fly home' : 'No shuttle is docked here'} onclick={() => api.dispatch({ type: 'crew.recall', ids: recallIds })}>Recall party</button>
  </div>
</Frame>

<style>
  .body { display: grid; gap: 8px; }
  .party { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  .party li { display: grid; grid-template-columns: 84px minmax(0, 1fr) 70px; gap: var(--sp-2); align-items: center; font-size: 13px; }
  .nm { all: unset; cursor: pointer; color: var(--text); font: 600 13px var(--head-font); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nm:hover, .nm:focus-visible { color: var(--cyan); }
  .st { font: 600 11px/1 var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; text-align: right; }
  .st.green { color: var(--green); } .st.amber { color: var(--amber); } .st.red { color: var(--red); } .st.cyan { color: var(--cyan); } .st.dim { color: var(--dim); }
  .sab { display: grid; gap: 4px; border-top: 1px solid var(--line); padding-top: 6px; }
  .line { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .line b { font: 600 13px var(--head-font); letter-spacing: 0.03em; }
  .dim, .hint { color: var(--dim); font-size: 12px; margin: 0; }
  .warn { display: grid; gap: 2px; padding: 5px 7px; border: 1px solid currentColor; border-left-width: 3px; font-size: 12px; line-height: 1.3; background: var(--panel-2, var(--panel)); }
  .warn b { font: 700 11px/1 var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
  .warn.red { color: var(--red); } .warn.amber { color: var(--amber); }
  .warn span { color: var(--text); }
  button.act, button.go { min-height: 26px; padding: 0 10px; font: 600 12px var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; background: var(--act-fill, var(--panel-2)); border: 1px solid var(--act-edge, var(--cyan)); }
  button.go { min-height: 32px; background: var(--go-fill); border-color: var(--go-edge); }
  button.go:disabled { opacity: 0.45; }
</style>
