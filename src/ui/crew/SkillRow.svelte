<script lang="ts">
  import type { UiSkillDetail } from '../crewDetailApi';
  import StatBar from '../inspector/StatBar.svelte';
  import Breakdown from '../inspector/Breakdown.svelte';
  import { PART_COLOR } from './format';

  /**
   * One skill: an attribute bar in whole-level cells coloured by where each level comes from (rolled start, experience,
   * a trait), levels a trait takes away hatched red, a tick at the role's level; then the terms in words and XP to the next level.
   */
  let { s, cells }: { s: UiSkillDetail; cells: number } = $props();
  const segments = $derived.by(() => {
    const out: { value: number; color: string; hatch?: boolean }[] = [];
    if (s.rolled) out.push({ value: s.rolled, color: PART_COLOR.rolled });
    if (s.xpLevels) out.push({ value: s.xpLevels, color: PART_COLOR.xp });
    for (const m of s.mods) if (m.op === 'add' && m.value > 0) out.push({ value: m.value, color: PART_COLOR[m.kind] });
    let lost = s.mods.filter((m) => m.op === 'add' && m.value < 0).reduce((n, m) => n - m.value, 0);
    // A lost level hatches the top of the bar: shrink the last segments and add a hatched one.
    const hatched = lost;
    for (let i = out.length - 1; i >= 0 && lost > 0; i--) {
      const take = Math.min(out[i]!.value, lost);
      out[i]!.value -= take;
      lost -= take;
    }
    if (hatched) out.push({ value: hatched, color: 'var(--red)', hatch: true });
    return out;
  });
</script>

<li class:zero={s.value === 0} data-testid="skill-row-{s.skill}">
  <span class="n">{s.name}</span>
  <span class="cellbar" style:width="{cells * 20}px"><StatBar size="lg" max={cells} {segments} baseline={s.role} cells title="{s.name} {s.value}, role {s.role}" /></span>
  <b class:up={s.value > s.role} class:down={s.value < s.role}>{s.value}</b>
  <span class="xp" title="{s.xp} of {s.per} XP to level {s.value + 1}{s.gain !== 1 ? ` (XP gains x${s.gain})` : ''}">
    <StatBar size="sm" value={s.xp} max={s.per} text="{s.xp}/{s.per} XP" />
  </span>
  {#if s.rolled || s.xpLevels || s.mods.length || s.role}<span class="terms">
    <Breakdown inline base={s.rolled ? { label: 'rolled', value: s.rolled } : undefined}
      rows={[...(s.xpLevels ? [{ label: 'XP', value: s.xpLevels }] : []), ...s.mods.map((m) => ({ label: m.label, value: m.value, op: m.op }))]}
      note="role {s.role}" />
  </span>{/if}
</li>

<style>
  li { display: grid; grid-template-columns: 78px auto 24px 1fr; grid-template-rows: auto auto; align-items: center; column-gap: 10px; row-gap: 3px; padding: 5px 6px; background: var(--panel-2); }
  li.zero { opacity: 0.55; }
  .n { font: 600 13px var(--head-font); letter-spacing: 0.04em; text-transform: uppercase; color: var(--text); }
  b { font: 700 18px/1 var(--head-font); text-align: right; color: var(--text); }
  b.up { color: #9fe0a8; } b.down { color: #ff9a9a; }
  .xp :global(.v) { min-width: 64px; font-size: 11px; color: var(--dim); }
  .terms { grid-column: 2 / 5; }
  .cellbar { display: block; }
</style>
