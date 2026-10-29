<script lang="ts">
  import type { UiApi, UiFightLine, UiFightReport } from '../api';
  import FloatingWindow from '../FloatingWindow.svelte';
  import { centerTop } from '../floatingWindow';
  import { Meter, Pill } from '../kit';

  /**
   * The post-fight breakdown, opened from its alert: the outcome, how long it took, the hull before and after, then only the lists that
   * have something in them. Lines that point at something jump to it (the one place a camera move is fine). Esc or the close button shuts it.
   */
  let { api, report }: { api: UiApi; report: UiFightReport } = $props();

  const OUTCOME: Record<UiFightReport['outcome'], { text: string; tone: 'red' | 'amber' | 'green' | 'dim' }> = {
    destroyed: { text: 'Enemy destroyed', tone: 'green' }, captured: { text: 'Captured', tone: 'green' }, disabled: { text: 'Enemy disabled', tone: 'green' },
    fled: { text: 'Enemy fled', tone: 'amber' }, youFled: { text: 'You fled', tone: 'amber' }, lost: { text: 'Ship lost', tone: 'red' }, ended: { text: 'Fight over', tone: 'dim' },
  };
  const out = $derived(OUTCOME[report.outcome]);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const hullFill = $derived(report.hullAfter < 0.35 ? 'var(--health-bad)' : report.hullAfter < 0.7 ? 'var(--health-warn)' : 'var(--health-good)');
  const groups = $derived<{ title: string; tone: string; lines: UiFightLine[] }[]>([
    { title: 'Crew dead', tone: 'bad', lines: report.dead },
    { title: 'Crew down', tone: 'bad', lines: report.down },
    { title: 'Modules lost', tone: 'bad', lines: report.lost },
    { title: 'Modules damaged', tone: 'warn', lines: report.damaged },
    { title: 'Enemy modules destroyed', tone: 'good', lines: report.enemyLost },
  ].filter((g) => g.lines.length));
  /** The same module (or same-named enemy module) twice in a list reads "Storage crate ×2". */
  const folded = (lines: UiFightLine[]) => {
    const out: { line: UiFightLine; n: number }[] = [];
    for (const l of lines) {
      const hit = out.find((o) => o.line.name === l.name && JSON.stringify(o.line.subject) === JSON.stringify(l.subject));
      if (hit) hit.n++;
      else out.push({ line: l, n: 1 });
    }
    return out;
  };
</script>

<FloatingWindow id="fightReport" title="Fight report" icon="combat" min={{ w: 300, h: 140 }} defaultRect={(b) => centerTop(b, 340, 0, 40)} onClose={() => api.closeFightReport()} testId="fight-report" closeTestId="fight-report-close" padded>
  <div class="top">
    <Pill tone={out.tone}>{out.text}</Pill>
    <span class="who">{report.enemy}</span>
    <span class="time" title="How long the fight lasted">{clock(report.seconds)}</span>
  </div>
  <div class="hull" title="Hull before and after: the mark shows where it started">
    <span class="k">Hull</span>
    <Meter value={report.hullAfter} fill={hullFill} height={14} notches={[report.hullBefore]} label="{pct(report.hullBefore)} to {pct(report.hullAfter)}" />
  </div>
  {#each groups as g (g.title)}
    <h4 class={g.tone}>{g.title}</h4>
    <ul>
      {#each folded(g.lines) as { line, n }, i (i)}
        <li><button disabled={!line.subject} title={line.subject ? 'Go there' : undefined} onclick={() => line.subject && api.focusSubject(line.subject)}>{line.name}{#if n > 1} <span class="n">×{n}</span>{/if}</button></li>
      {/each}
    </ul>
  {/each}
  {#if report.ammo.length}
    <h4>Ammo spent</h4>
    <p>{report.ammo.map((a) => `${a.name} ×${a.n}`).join(', ')}</p>
  {/if}
  {#if report.prize}
    <h4 class="good">Prize</h4>
    <p>{report.prize}</p>
  {/if}
  {#if !groups.length && !report.ammo.length && !report.prize}<p class="none">Nothing lost, nothing destroyed.</p>{/if}
</FloatingWindow>

<style>
  .top { display: flex; align-items: center; gap: var(--sp-2); }
  .top :global(.pill) { margin: 0; }
  .who { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .time { color: var(--dim); font: 600 12px/1 var(--head-font); }
  .hull { display: grid; grid-template-columns: 40px 1fr; align-items: center; margin: var(--sp-2) 0; }
  .k { color: var(--dim); font-size: 12px; }
  h4 { margin: var(--sp-2) 0 2px; font: 700 11px/1 var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; color: var(--cyan); }
  h4.bad { color: var(--red); }
  h4.warn { color: var(--amber); }
  h4.good { color: var(--green); }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 2px 10px; }
  li button { padding: 2px 0; background: transparent; border: 0; border-bottom: 1px dotted var(--dim); color: inherit; font-size: 13px; }
  li button:disabled { border-bottom-color: transparent; }
  .n { color: var(--dim); }
  p { margin: 0; font-size: 13px; }
  .none { color: var(--dim); }
</style>
