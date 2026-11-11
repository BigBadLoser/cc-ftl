<script lang="ts">
  import Icon, { type IconName } from '../Icon.svelte';
  import { SKILL_ICON } from '../crew/format';
  import Section from '../inspector/Section.svelte';
  import type { UiRollCrew, UiShipJob } from './titleApi';

  /**
   * The ship's jobs (docs/TRAITS.md 10.8): each job the hull needs, the best level aboard and who has it; under WEAK it reads amber,
   * nobody at all red.
   */
  let { crew, jobs }: { crew: UiRollCrew[]; jobs: UiShipJob[] } = $props();
  const WEAK = 3;
  const best = $derived(jobs.map((j) => {
    let b: { v: number; who: string } | null = null;
    for (const c of crew) {
      const v = Math.max(0, ...c.skills.filter((s) => j.skills.includes(s.skill) && !s.struck).map((s) => s.value));
      if (v > 0 && (!b || v > b.v)) b = { v, who: c.name };
    }
    return { ...j, b };
  }));
</script>

{#snippet extra()}best aboard{/snippet}
<div class="cov" data-testid="crew-coverage">
  <Section title="Ship's jobs" {extra}>
    <div class="grid">
      {#each best as j (j.id)}
        <div class="row" class:weak={!!j.b && j.b.v < WEAK} class:none={!j.b} data-testid="ship-job">
          <span class="ic"><Icon name={(SKILL_ICON[j.skills[0] ?? ''] ?? 'list') as IconName} size={15} /></span><span>{j.name}</span>
          <b>{j.b?.v ?? 0}</b><span class="who">{j.b?.who ?? 'nobody'}</span>
        </div>
      {/each}
    </div>
  </Section>
</div>

<style>
  .cov { padding: 4px 12px 0; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 20px; }
  .row { display: grid; grid-template-columns: 16px 1fr 18px 58px; column-gap: 8px; align-items: center; min-height: 28px; border-bottom: 1px solid var(--panel-3); font-size: 13px; }
  .ic { display: inline-flex; color: var(--cyan); }
  b { font: 700 16px/1 var(--head-font); text-align: right; }
  .who { text-align: right; color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .weak b, .weak .who { color: var(--amber); }
  .none .ic, .none b, .none .who { color: var(--red); }
</style>
