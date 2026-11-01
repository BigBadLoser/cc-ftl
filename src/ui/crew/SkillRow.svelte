<script lang="ts">
  import type { UiSkillDetail } from '../crewDetailApi';
  import Icon, { type IconName } from '../Icon.svelte';
  import { SKILL_ICON, SOURCE_COLOR } from './format';

  /**
   * One trained skill: icon, name, level, then a pip per level coloured by where it comes from (rolled, XP, trait) with a thin
   * grey XP bar under the pips and the XP % after them. Hovering the row highlights it and opens its breakdown card.
   */
  let { s, max, role }: { s: UiSkillDetail; max: number; role: string } = $props();
  const pips = $derived.by(() => {
    const seq: (keyof typeof SOURCE_COLOR)[] = [];
    for (let i = 0; i < s.rolled; i++) seq.push('rolled');
    for (let i = 0; i < s.xpLevels; i++) seq.push('xp');
    for (const m of s.mods) if (m.op === 'add' && m.value > 0) for (let i = 0; i < m.value; i++) seq.push('trait');
    return seq.slice(0, Math.max(0, s.value));
  });
  const pct = $derived(Math.round((s.xp / s.per) * 100));
  const sgn = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v)}`;
</script>

<li data-testid="skill-row-{s.skill}">
  <span class="ic"><Icon name={(SKILL_ICON[s.skill] ?? 'list') as IconName} size={15} /></span>
  <span class="n">{s.name}</span>
  <b>{s.value}</b>
  <span class="pips">
    <span class="row">{#each Array.from({ length: max }, (_v, i) => i) as i (i)}<i style:--k={pips[i] ? SOURCE_COLOR[pips[i]] : undefined} class:on={!!pips[i]}></i>{/each}</span>
    <span class="xp"><i style:width="{pct}%"></i></span>
  </span>
  <span class="pc">{pct}%</span>
  <div class="tip" data-testid="skill-tip-{s.skill}">
    <div class="h">{s.name} {s.value}</div>
    <div class="r"><span class="l">Rolled at start</span><span>{s.rolled}</span></div>
    <div class="r"><span class="l">From XP</span><span class="xpc">{s.xpLevels ? `+${s.xpLevels}` : '0'}</span></div>
    {#each s.mods as m, i (i)}<div class="r" class:pos={m.op === 'add' ? m.value > 0 : m.value > 1} class:neg={m.op === 'add' ? m.value < 0 : m.value < 1}><span>{m.label}{m.kind === 'trait' ? ' (trait)' : ''}</span><span>{m.op === 'add' ? sgn(m.value) : `x${m.value}`}</span></div>{/each}
    <hr />
    <div class="r"><span class="l">Role baseline</span><span>{s.role} ({role.toLowerCase()})</span></div>
    <div class="r"><span class="l">Next level</span><span>{pct}% ({s.xp}/{s.per} XP)</span></div>
    {#if s.gain !== 1}<div class="r"><span class="l">XP gains</span><span class="pos">x{s.gain}</span></div>{/if}
  </div>
</li>

<style>
  li { position: relative; display: grid; grid-template-columns: 18px 84px 22px var(--pips-w) 1fr; column-gap: 10px; align-items: center; padding: 8px 0 9px; border-bottom: 1px solid var(--panel-3); }
  li:hover { background: var(--panel-2); }
  .ic { display: inline-flex; color: var(--cyan); }
  .n { font-size: 13px; }
  b { font: 700 17px/1 var(--head-font); text-align: right; }
  .pips { display: grid; gap: 4px; }
  .row { display: flex; gap: 3px; }
  .row i { display: block; width: 24px; height: 10px; box-sizing: border-box; background: var(--track); border: 1px solid var(--line); }
  .row i.on { background: var(--k); border-color: var(--k); }
  .xp { display: block; height: 3px; background: #141a20; }
  .xp i { display: block; height: 100%; background: #7d858c; }
  .pc { align-self: end; line-height: 1; font-size: 11px; color: var(--dim); }
  .tip { display: none; position: absolute; left: 112px; top: calc(100% - 2px); z-index: 3; width: 236px; padding: 8px 10px; background: var(--panel); border: 1px solid var(--line-hi); box-shadow: 0 6px 18px rgba(0, 0, 0, 0.6); }
  li:hover .tip { display: block; }
  .h { margin-bottom: 4px; font: 600 12px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; }
  .r { display: flex; justify-content: space-between; min-height: 20px; font-size: 12px; }
  .l { color: var(--dim); }
  .xpc { color: #c9ced3; }
  .pos { color: #9fe0a8; } .neg { color: #ff9a9a; }
  hr { border: 0; border-top: 1px solid var(--line); margin: 4px 0; }
</style>
