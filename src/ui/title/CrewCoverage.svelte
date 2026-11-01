<script lang="ts">
  import Icon, { type IconName } from '../Icon.svelte';
  import { SKILL_ICON } from '../crew/format';
  import Section from '../inspector/Section.svelte';
  import type { UiRollCrew } from './titleApi';

  /** The crew's coverage: the best level aboard for each skill and who has it; a skill nobody has shows red. */
  let { crew }: { crew: UiRollCrew[] } = $props();
  const best = $derived(crew[0]?.skills.map((s, i) => {
    let b: { v: number; who: string } | null = null;
    for (const c of crew) {
      const v = c.skills[i]?.value ?? 0;
      if (v > 0 && (!b || v > b.v)) b = { v, who: c.name };
    }
    return { skill: s.skill, name: s.name, b };
  }) ?? []);
</script>

{#snippet extra()}best aboard per skill{/snippet}
<div class="cov" data-testid="crew-coverage">
  <Section title="Crew coverage" {extra}>
    <div class="grid">
      {#each best as s (s.skill)}
        <div class="row" class:none={!s.b}>
          <span class="ic"><Icon name={(SKILL_ICON[s.skill] ?? 'list') as IconName} size={15} /></span><span>{s.name}</span>
          <b>{s.b?.v ?? 0}</b><span class="who">{s.b?.who ?? 'nobody'}</span>
        </div>
      {/each}
    </div>
  </Section>
</div>

<style>
  .cov { padding: 4px 12px 0; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 20px; }
  .row { display: grid; grid-template-columns: 16px 1fr 14px 58px; column-gap: 8px; align-items: center; min-height: 28px; border-bottom: 1px solid var(--panel-3); font-size: 13px; }
  .ic { display: inline-flex; color: var(--cyan); }
  b { font: 700 16px/1 var(--head-font); text-align: right; }
  .who { text-align: right; color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .none .ic, .none b, .none .who { color: #ff9a9a; }
</style>
