<script lang="ts">
  import type { UiSkillDetail } from '../crewDetailApi';
  import Icon, { type IconName } from '../Icon.svelte';
  import { SKILL_ICON } from './format';
  import Pips, { pipsOf } from '../inspector/Pips.svelte';

  /**
   * One skill: icon, name, level, then a pip per level (of 10) coloured by where it comes from (rolled, XP, trait) with a thin grey XP
   * bar under the pips, the interest mark and the XP % after them. Hovering the row highlights it and opens its breakdown card.
   */
  let { s, max }: { s: UiSkillDetail; max: number } = $props();
  const pips = $derived(pipsOf(s.rolled, s.xpLevels,
    s.mods.reduce((n, m) => n + (m.op === 'add' && m.value > 0 ? m.value : 0), 0),
    s.mods.reduce((n, m) => n + (m.op === 'add' && m.value < 0 ? -m.value : 0), 0)).slice(0, max));
  const pct = $derived((s.per ? Math.round((s.xp / s.per) * 100) : 100)); // per is 0 at the XP cap
  const sgn = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v)}`;
</script>

<li data-testid="skill-row-{s.skill}" class:zero={s.value <= 0} class:struck={s.struck}>
  <span class="ic"><Icon name={(SKILL_ICON[s.skill] ?? 'list') as IconName} size={15} /></span>
  <span class="n">{s.name}</span>
  <b>{s.value}{#if s.value > max}+{/if}</b>
  <span class="pips">
    <Pips cells={pips} {max} />
    <span class="xp"><i style:width="{pct}%"></i></span>
  </span>
  <span class="pc">{#if s.interest}<i class="int">{s.interest > 1 ? '✦✦' : '✦'}</i>{/if}{s.value > 0 || s.xp > 0 ? `${pct}%` : ''}</span>
  <div class="tip" data-testid="skill-tip-{s.skill}">
    <div class="h">{s.name} {s.value}</div>
    <div class="r"><span class="l">Rolled at start</span><span>{s.rolled}</span></div>
    <div class="r"><span class="l">From XP</span><span class="xpc">{s.xpLevels ? `+${s.xpLevels}` : '0'}</span></div>
    {#each s.mods as m, i (i)}<div class="r" class:pos={m.op === 'add' ? m.value > 0 : m.value > 1} class:neg={m.op === 'add' ? m.value < 0 : m.value < 1}><span>{m.label}{m.kind === 'trait' ? ' (trait)' : ''}</span><span>{m.op === 'add' ? sgn(m.value) : `x${m.value}`}</span></div>{/each}
    <hr />
    {#if s.interest}<div class="r"><span class="l">Interest</span><span class="int">{s.interest > 1 ? 'Passionate' : 'Keen'}</span></div>{/if}
    {#if s.struck}<div class="r"><span class="l">Won't do</span><span class="neg">this work</span></div>{/if}
    <div class="r"><span class="l">Next level</span><span>{s.per ? `${pct}% (${s.xp}/${s.per} XP)` : 'Maxed'}</span></div>
    {#if s.gain !== 1}<div class="r"><span class="l">XP gains</span><span class="pos">x{s.gain}</span></div>{/if}
  </div>
</li>

<style>
  li { position: relative; display: grid; grid-template-columns: 18px 92px 26px var(--pips-w) 1fr; column-gap: 10px; align-items: center; padding: 5px 0 6px; border-bottom: 1px solid var(--panel-3); }
  li:hover { background: var(--panel-2); }
  .ic { display: inline-flex; color: var(--cyan); }
  .n { font-size: 13px; }
  b { font: 700 17px/1 var(--head-font); text-align: right; }
  .pips { display: grid; gap: 4px; }
  .xp { display: block; height: 3px; background: var(--track); }
  .xp i { display: block; height: 100%; background: #7d858c; }
  .pc { align-self: end; line-height: 1; font-size: 11px; color: var(--dim); white-space: nowrap; }
  .int { font-style: normal; color: var(--amber); margin-right: 6px; }
  .zero .ic, .zero .n, .zero b { color: var(--dim); }
  .struck .n { text-decoration: line-through; color: var(--red); }
  .tip { display: none; position: absolute; left: 112px; top: calc(100% - 2px); z-index: 3; width: 210px; padding: 5px 8px; background: var(--panel); border: 1px solid var(--line-hi); box-shadow: 0 6px 18px rgba(0, 0, 0, 0.6); }
  li:hover .tip { display: block; }
  .h { margin-bottom: 2px; font: 600 11px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; }
  .r { display: flex; justify-content: space-between; line-height: 18px; font-size: 12px; }
  .l { color: var(--dim); }
  .xpc { color: #c9ced3; }
  .pos { color: var(--good-ink); } .neg { color: var(--red); }
  hr { border: 0; border-top: 1px solid var(--line); margin: 3px 0; }
</style>
