<script lang="ts">
  import type { UiCrew } from '../api';
  import type { UiCrewDetail } from '../crewDetailApi';
  import Section from '../inspector/Section.svelte';
  import TraitChips from '../inspector/TraitChips.svelte';
  import SkillRow from './SkillRow.svelte';
  import { SOURCE_COLOR } from './format';

  /**
   * The crew Skills tab: one row per trained skill (breakdown on hover), the untrained ones on one line with the pip legend,
   * the traits one line each (full text on hover), and the other stats in two columns (a dot when modified, sources on hover).
   */
  let { c, d }: { c: UiCrew; d: UiCrewDetail | null } = $props();
  const trained = $derived(d?.skills.filter((s) => s.value > 0) ?? []);
  const untrained = $derived(d?.skills.filter((s) => s.value <= 0) ?? []);
  // The pip track stays six 24px pips wide (159px); a skill past level 6 shrinks the pips instead of widening the row.
  // Room for every pip, the red ones a trait took away included.
  const max = $derived(Math.max(6, ...trained.map((s) => s.rolled + s.xpLevels + s.mods.reduce((n, m) => n + (m.op === 'add' && m.value > 0 ? m.value : 0), 0))));
  const num = (v: number, unit: string) => (unit && unit !== 'x' ? `${v} ${unit}` : `${v}`);
  const part = (p: { op: 'add' | 'mul'; value: number; label: string }) => `${p.op === 'mul' ? `x${p.value}` : `${p.value >= 0 ? '+' : '−'}${Math.abs(p.value)}`} ${p.label}`;
  const good = (p: { op: 'add' | 'mul'; value: number }, invert: boolean) => (p.op === 'mul' ? p.value > 1 : p.value > 0) !== invert;
</script>

{#if d}
  <Section testId="crew-skills-detail">
    <ul class="rows" style:--pips-w="159px">{#each trained as s (s.skill)}<SkillRow {s} {max} role={c.role} />{/each}</ul>
    <div class="foot">
      <span>{#if untrained.length}Untrained: {untrained.map((s) => s.name).join(', ')}{/if}</span>
      <span class="key">{#each Object.entries({ rolled: 'rolled', xp: 'XP', trait: 'trait', lost: 'trait −' }) as [k, l] (k)}<span><i style:background={SOURCE_COLOR[k as keyof typeof SOURCE_COLOR]}></i>{l}</span>{/each}</span>
    </div>
  </Section>
  {#if d.traits.length}<Section title="Traits" testId="crew-traits-detail"><TraitChips traits={d.traits} list /></Section>{/if}
  <Section title="Other stats" testId="crew-stats-detail">
    <div class="stats">
      {#each d.stats as st (st.stat)}
        {@const inv = st.stat === 'restDecay'}
        <div class="st" title={[`${num(st.base, st.unit)} base`, ...st.parts.map(part)].join(' · ')}>
          <span class="l">{st.name}</span>
          <span>{num(st.value, st.unit)}{#if st.parts.length}<i class="dot" class:pos={st.parts.every((p) => good(p, inv))} class:neg={!st.parts.every((p) => good(p, inv))}>●</i>{/if}</span>
        </div>
      {/each}
    </div>
  </Section>
{/if}

<style>
  .rows { list-style: none; margin: 0; padding: 0; }
  .foot { display: flex; gap: 10px; padding-top: 8px; font-size: 11px; color: var(--dim); }
  .key { margin-left: auto; display: inline-flex; gap: 8px; }
  .key span { display: inline-flex; align-items: center; gap: 3px; }
  .key i { display: inline-block; width: 8px; height: 8px; }
  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
  .st { display: flex; justify-content: space-between; align-items: center; min-height: 22px; font-size: 12px; border-bottom: 1px solid var(--panel-3); cursor: help; }
  .l { color: var(--dim); }
  .dot { margin-left: 4px; font-style: normal; }
  .pos { color: #9fe0a8; } .neg { color: #ff9a9a; }
</style>
