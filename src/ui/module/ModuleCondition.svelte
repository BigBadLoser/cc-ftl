<script lang="ts">
  import type { UiModule } from '../api';
  import Section from '../inspector/Section.svelte';
  import StatBar from '../inspector/StatBar.svelte';
  import ConditionList from '../inspector/ConditionList.svelte';
  import type { Condition } from '../inspector/blocks';
  import { moduleState } from './state';

  /** The module Condition tab (the generic inspector's second user): hull points, and running state, power and repair order as conditions. */
  let { m }: { m: UiModule } = $props();
  const items = $derived<Condition[]>([
    { key: 'state', label: 'State', text: moduleState(m), pct: null, tone: moduleState(m) === 'Running' ? 'good' : m.hp <= 0 ? 'bad' : 'warn' },
    { key: 'power', label: 'Power', text: m.power > 0 ? `+${m.power} supply` : m.power < 0 ? `${-m.power} draw${m.powered ? '' : ', unpowered'}` : 'none', pct: null, tone: m.power < 0 && !m.powered ? 'bad' : 'ok' },
    ...(m.hp < m.maxHp ? [{ key: 'repair', label: 'Repair', text: m.repairFirst ? 'first in the queue' : 'queued', pct: null, tone: 'warn' as const }] : []),
    ...(m.suits ? [{ key: 'suits', label: 'EVA suits', text: `${m.suits.stowed} of ${m.suits.max}`, pct: (m.suits.stowed / Math.max(1, m.suits.max)) * 100, tone: 'ok' as const }] : []),
  ]);
</script>

<Section title="Hull points" icon="wrench" testId="module-condition">
  <StatBar size="lg" value={(m.hp / Math.max(1, m.maxHp)) * 100} color="var(--hp)" low={m.hp < m.maxHp * 0.4} text="{m.hp}/{m.maxHp}" />
</Section>
<Section title="Status" icon="power"><ConditionList items={items} /></Section>
