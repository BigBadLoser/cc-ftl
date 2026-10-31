<script lang="ts">
  import type { UiCrewDetail } from '../crewDetailApi';
  import Section from '../inspector/Section.svelte';
  import Breakdown from '../inspector/Breakdown.svelte';
  import TraitChips from '../inspector/TraitChips.svelte';
  import SkillRow from './SkillRow.svelte';
  import { PART_COLOR } from './format';

  /** The crew Skills tab: every skill taken apart, the traits with their exact effects, and the other stats with their sources. */
  let { d }: { d: UiCrewDetail | null } = $props();
  const cells = $derived(d ? Math.max(6, ...d.skills.map((s) => Math.max(s.role, s.rolled + s.xpLevels + s.mods.reduce((n, m) => n + (m.op === 'add' && m.value > 0 ? m.value : 0), 0)))) : 6);
  const num = (v: number, unit: string) => (unit && unit !== 'x' ? `${v} ${unit}` : `${v}`);
</script>

{#snippet legend()}
  <span class="key"><i style:background={PART_COLOR.rolled}></i>rolled<i style:background={PART_COLOR.xp}></i>XP<i style:background={PART_COLOR.trait}></i>trait<i class="role"></i>role level</span>
{/snippet}

{#if d}
  <Section title="Skills" icon="list" testId="crew-skills-detail" extra={legend}>
    <ul class="rows">{#each d.skills as s (s.skill)}<SkillRow {s} {cells} />{/each}</ul>
  </Section>
  {#if d.traits.length}
    <Section title="Traits" icon="flag" testId="crew-traits-detail"><TraitChips traits={d.traits} detailed /></Section>
  {/if}
  <Section title="Other stats" icon="bolt" testId="crew-stats-detail">
    <ul class="stats">
      {#each d.stats as st (st.stat)}
        <li>
          <span class="n">{st.name}</span>
          <Breakdown inline invert={st.stat === 'restDecay'} base={{ label: 'base', value: num(st.base, st.unit) }} rows={st.parts.map((p) => ({ label: p.label, value: p.value, op: p.op }))} />
          <b class:mod={st.parts.length > 0}>{num(st.value, st.unit)}</b>
        </li>
      {/each}
    </ul>
  </Section>
{/if}

<style>
  .key { display: flex; align-items: center; gap: 4px; font: 11px var(--head-font); }
  .key i { display: inline-block; width: 9px; height: 9px; margin-left: 6px; }
  .key i.role { width: 2px; height: 12px; background: #fff; }
  .rows, .stats { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  .stats li { display: grid; grid-template-columns: 100px 1fr auto; gap: 10px; align-items: center; padding: 4px 6px; background: var(--panel-2); font-size: 12px; }
  .stats .n { color: var(--dim); }
  .stats b { font: 600 14px var(--head-font); color: var(--text); white-space: nowrap; }
  .stats b.mod { color: #fff; }
</style>
