<script lang="ts">
  import type { UiApi, UiCrew } from '../api';
  import type { UiCrewDetail } from '../crewDetailApi';
  import Section from '../inspector/Section.svelte';
  import SlotGrid from '../inspector/SlotGrid.svelte';
  import type { Slot } from '../inspector/blocks';

  /** The crew Gear tab: the loadout as slots (an empty slot is an empty box), and the hand weapons in storage here to equip. */
  let { api, c, d }: { api: UiApi; c: UiCrew; d: UiCrewDetail | null } = $props();
  const loadout = $derived<Slot[]>((d?.gear ?? []).map((g, i) => ({
    key: `${g.slot}-${i}`, label: g.label, wide: g.slot === 'weapon',
    item: g.item && { icon: g.item.id, name: g.item.name, count: g.item.count, lines: g.item.lines, note: g.item.natural ? 'natural' : undefined },
    action: g.slot === 'weapon' && g.item && !g.item.natural ? { label: 'Stow', testId: 'gear-unequip', onClick: () => api.dispatch({ type: 'crew.unequip', id: c.id }) } : undefined,
  })));
  const nearby = $derived<Slot[]>(c.arms.map((a) => ({
    key: a.item, label: 'Hand weapon', item: { icon: a.item, name: a.name, count: a.count },
    action: { label: 'Equip', disabled: c.weapon?.item === a.item, testId: `gear-equip-${a.item}`, onClick: () => api.dispatch({ type: 'crew.equip', id: c.id, item: a.item }) },
  })));
</script>

{#if d}
  <Section title="Loadout" icon="stock" testId="crew-gear"><SlotGrid {api} slots={loadout} /></Section>
  {#if nearby.length}<Section title="In storage on this ship" icon="ship" testId="crew-gear-nearby"><SlotGrid {api} slots={nearby} /></Section>{/if}
{/if}
