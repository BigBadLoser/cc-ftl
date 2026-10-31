<script lang="ts">
  import type { UiCrewDetail } from '../crewDetailApi';
  import Section from '../inspector/Section.svelte';
  import StatBar from '../inspector/StatBar.svelte';
  import ConditionList from '../inspector/ConditionList.svelte';
  import Breakdown from '../inspector/Breakdown.svelte';
  import { moodWord } from './format';

  /** The crew Status tab: health and every condition, then mood with its whole breakdown (base, each factor, total). */
  let { d }: { d: UiCrewDetail | null } = $props();
  const sum = $derived(d?.mood ? d.mood.base + d.mood.factors.reduce((n, f) => n + f.value, 0) : 0);
</script>

{#if d}
  <Section title="Health" icon="heart" testId="crew-status">
    <div class="big"><StatBar size="lg" value={(d.health.hp / Math.max(1, d.health.maxHp)) * 100} color="var(--hp)" low={d.health.hp < d.health.maxHp * 0.4} text="{d.health.hp}/{d.health.maxHp}" /></div>
    <ConditionList items={d.health.conditions} />
  </Section>
  {#if d.mood}
    <Section title="Mood" icon="smile" testId="crew-mood-breakdown">
      <div class="big"><StatBar size="lg" value={d.mood.value} color="#b58cff" low={d.mood.value < 35} text="{d.mood.value} {moodWord(d.mood.value)}" /></div>
      <Breakdown base={{ label: 'Base', value: d.mood.base }}
        rows={[...d.mood.factors.map((f) => ({ label: f.label, value: f.value, tag: f.trait ? 'trait' : undefined }))]}
        total={{ label: sum !== d.mood.value ? 'Mood (kept within 0 to 100)' : 'Mood', value: d.mood.value }}
        note={d.mood.workMult < 1 ? `Low mood: work speed x${d.mood.workMult}` : undefined} />
    </Section>
  {/if}
{/if}

<style>
  .big { margin-bottom: 8px; }
</style>
