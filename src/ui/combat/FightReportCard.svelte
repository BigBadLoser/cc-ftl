<script lang="ts">
  import type { UiApi, UiFightReport } from '../api';
  import FloatingWindow from '../FloatingWindow.svelte';
  import Icon from '../Icon.svelte';
  import { centerTop } from '../floatingWindow';
  import { Frame } from '../kit';
  import { lossRows } from './lossRows';
  import './steel.css';

  /**
   * The post-fight breakdown, opened from its alert, in the combat HUD's palette: the outcome as a coloured title with the duration, a
   * You | Enemy block, then your losses as clickable rows (a box or dot, the name, its state in its colour). Rows jump to their subject;
   * Esc or the close button shuts the card. There is no salvage row: the UI has no salvage data.
   */
  let { api, report }: { api: UiApi; report: UiFightReport } = $props();

  type Tone = 'good' | 'warn' | 'bad' | 'dim';
  const title = $derived.by((): { text: string; tone: Tone } => {
    const who = report.enemy.toUpperCase();
    switch (report.outcome) {
      case 'destroyed': return { text: `${who} DESTROYED`, tone: 'good' };
      case 'disabled': return { text: `${who} DISABLED`, tone: 'good' };
      case 'captured': return { text: 'CAPTURED', tone: 'good' };
      case 'fled': return { text: 'ENEMY FLED', tone: 'warn' };
      case 'youFled': return { text: 'YOU FLED', tone: 'warn' };
      case 'lost': return { text: 'SHIP LOST', tone: 'bad' };
      default: return { text: 'FIGHT OVER', tone: 'dim' };
    }
  });
  const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const delta = $derived(Math.round((report.hullAfter - report.hullBefore) * 100));
  const hullText = $derived(delta === 0 ? '0%' : `${delta < 0 ? '−' : '+'}${Math.abs(delta)}%`);
  const enemyHull = $derived(report.enemyHull === null ? '?' : `${Math.round(report.enemyHull * 100)}%`);
  const ammoTotal = $derived(report.ammo.reduce((n, a) => n + a.n, 0));
  const ammoName = $derived(report.ammo.length === 1 ? (report.ammo[0]?.name ?? 'Ammo') : 'Ammo');
  const crewDead = $derived(report.dead.length);

  const rows = $derived(lossRows(report));
</script>

<FloatingWindow id="fightReport" title="Fight report" min={{ w: 320, h: 140 }} defaultRect={(b) => centerTop(b, 360, 0, 40)} onClose={() => api.closeFightReport()} testId="fight-report" bare bg={false} class="fr-card">
  <div class="steel card">
    <Frame title="Fight report">
      <div class="ph head">
        <h2 class={title.tone}>{title.text}</h2>
        <span class="time" title="How long the fight lasted">{clock(report.seconds)}</span>
        <button class="x" aria-label="Close" title="Close (Esc)" data-testid="fight-report-close" onclick={() => api.closeFightReport()}><Icon name="close" size={12} /></button>
      </div>
      <div class="cols">
        <div class="col">
          <span class="who">You</span>
          <b class="big">{hullText}<small>Hull</small></b>
          {#if report.lost.length}<div class="kv"><span>Modules lost</span><b>{report.lost.length}</b></div>{/if}
          {#if report.down.length}<div class="kv"><span>Crew down</span><b>{report.down.length}</b></div>{/if}
          {#if crewDead}<div class="kv"><span>Crew dead</span><b>{crewDead}</b></div>{/if}
          {#if ammoTotal}<div class="kv"><span>{ammoName}</span><b>{ammoTotal}</b></div>{/if}
        </div>
        <div class="col foe">
          <span class="who">{report.enemy}</span>
          <b class="big">{enemyHull}<small>Hull</small></b>
          {#if report.enemyLost.length}<div class="kv"><span>Modules lost</span><b>{report.enemyLost.length}</b></div>{/if}
          {#if report.enemyCrew}<div class="kv"><span>Crew</span><b>{report.enemyCrew} dead</b></div>{/if}
          {#if report.prize}<div class="kv"><span>Prize</span><b>{report.prize}</b></div>{/if}
        </div>
      </div>
      {#if rows.length}
        <div class="loss">
          <span class="who">Your losses</span>
          <ul>
            {#each rows as r, i (i)}
              <li>
                <button disabled={!r.subject} title={r.subject ? 'Go there' : undefined} onclick={() => r.subject && api.focusSubject(r.subject)}>
                  <i class="mark {r.tone}" class:dot={r.dot}></i>
                  <span class="nm">{r.name}{#if r.n > 1}&nbsp;×{r.n}{/if}</span>
                  <em class={r.tone}>{r.state}</em>
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </Frame>
  </div>
</FloatingWindow>

<style>
  .card { color: var(--text); background: var(--panel); }
  .card :global(.frame) { padding: 8px 0 0; }
  .ph.head {
    margin: 0;
    padding: 4px 8px 8px 12px !important; /* the window reserves room for a pin; this card has none */
    background: transparent;
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-height: 0;
  }
  h2 { flex: 1; margin: 0; font: 700 24px/1 var(--head-font); letter-spacing: 0.04em; }
  h2.good { color: var(--green); }
  h2.warn { color: var(--amber); }
  h2.bad { color: var(--red); }
  h2.dim { color: var(--dim); }
  .time { margin-left: auto; font: 600 13px/1 var(--head-font); color: var(--dim); }
  .x { flex: none; align-self: center; min-width: 0; min-height: 0; width: 20px; height: 20px; padding: 0; display: grid; place-items: center; background: transparent; border: 0; color: var(--dim); }
  .x:hover { color: var(--text); background: var(--panel-2); }
  .cols { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--frame-line); }
  .col { padding: 8px 12px 10px; display: grid; gap: 3px; align-content: start; min-width: 0; }
  .col + .col { border-left: 1px solid var(--frame-line); }
  .who { font: 600 11px/1 var(--head-font); letter-spacing: 0.1em; text-transform: uppercase; color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .foe .who { color: var(--hostile-dim); }
  .big { font: 700 26px/1.1 var(--head-font); color: var(--text); }
  .foe .big { color: var(--hostile); }
  .big small { margin-left: 6px; font: 600 11px/1 var(--head-font); letter-spacing: 0.1em; text-transform: uppercase; color: var(--dim); }
  .kv { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
  .kv span { color: var(--dim); }
  .kv b { font-weight: 700; color: var(--text); }
  .loss { border-top: 1px solid var(--frame-line); padding: 8px 12px 8px; display: grid; gap: 4px; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 1px; max-height: 190px; overflow-y: auto; }
  li button {
    width: 100%; min-height: 0; min-width: 0; padding: 4px 4px; display: flex; align-items: center; gap: 8px;
    background: transparent; border: 0; color: var(--text); font: 600 14px var(--head-font); text-align: left;
  }
  li button:not(:disabled):hover { background: var(--panel-2); }
  li button:disabled { opacity: 1; cursor: default; }
  .mark { flex: none; width: 14px; height: 14px; border: 1px solid currentColor; box-sizing: border-box; }
  .mark.dot { border: 0; border-radius: 50%; background: currentColor; width: 9px; height: 9px; margin: 0 2.5px; }
  .mark.bad, em.bad { color: var(--red); }
  .mark.warn, em.warn { color: var(--amber); }
  .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  em { font: 700 12px var(--head-font); font-style: normal; letter-spacing: 0.08em; }
</style>
