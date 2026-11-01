<script lang="ts">
  import type { UiCrewDetail } from '../crewDetailApi';
  import Section from '../inspector/Section.svelte';
  import ConditionList from '../inspector/ConditionList.svelte';
  import Breakdown from '../inspector/Breakdown.svelte';
  import type { Condition } from '../inspector/blocks';
  import { moodWord } from './format';

  /**
   * The crew Status tab on the inspector grid: health and the needs as bars, then a Conditions line that lists only real
   * conditions (downed, surrendered); mood with its whole breakdown (base, each factor with the trait behind it, total).
   */
  let { d }: { d: UiCrewDetail | null } = $props();
  const health = $derived.by<Condition[]>(() => {
    if (!d) return [];
    const bars = d.health.conditions.filter((c) => c.pct !== null);
    const other = d.health.conditions.filter((c) => c.pct === null);
    return [
      { key: 'hp', label: 'Health', text: `${d.health.hp} / ${d.health.maxHp}`, pct: (d.health.hp / Math.max(1, d.health.maxHp)) * 100, tone: d.health.hp < d.health.maxHp * 0.4 ? 'bad' : 'ok', color: 'var(--hp)' },
      ...bars.map((c) => ({ ...c, color: c.key === 'hunger' || c.key === 'rest' ? (c.tone === 'bad' ? 'var(--red)' : 'var(--amber)') : undefined })),
      { key: 'conditions', label: 'Conditions', text: other.length ? other.map((c) => `${c.label}: ${c.text}`).join(', ') : 'none', pct: null, tone: other.some((c) => c.tone === 'bad') ? 'bad' : other.length ? 'warn' : 'dim' },
    ];
  });
  const mood = $derived<Condition[]>(d?.mood ? [{ key: 'mood', label: 'Mood', text: `${d.mood.value} ${moodWord(d.mood.value)}`, pct: d.mood.value, tone: d.mood.value < 35 ? 'bad' : 'ok', color: '#b58cff' }] : []);
</script>

{#if d}
  <Section title="Health" testId="crew-status"><ConditionList items={health} /></Section>
  {#if d.mood}
    <Section title="Mood" testId="crew-mood-breakdown">
      <ConditionList items={mood} />
      <Breakdown base={{ label: 'Base', value: d.mood.base }}
        rows={d.mood.factors.map((f) => ({ label: f.label, value: f.value, tag: f.source }))}
        total={{ label: 'Total', value: d.mood.value }}
        note="Below 35, mood slows work.{d.mood.workMult < 1 ? ` Now x${d.mood.workMult}.` : ''}" />
    </Section>
  {/if}
{/if}
