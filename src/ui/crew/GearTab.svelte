<script lang="ts">
  import type { UiApi, UiCrew } from '../api';
  import type { UiCrewDetail, UiGearSlot } from '../crewDetailApi';
  import Section from '../inspector/Section.svelte';
  import PaperDoll from '../inspector/PaperDoll.svelte';
  import SlotBox from '../inspector/SlotBox.svelte';
  import type { Slot } from '../inspector/blocks';

  /**
   * The crew Gear tab: the loadout on a body (carrying, weapon, implant, armor), each item's stats card on hover, then the
   * hand weapons in storage on this ship to equip (their cards too, as this crew member would use them).
   */
  let { api, c, d }: { api: UiApi; c: UiCrew; d: UiCrewDetail | null } = $props();
  const GLYPH = { weapon: 'sword', suit: 'shirt', hands: 'backpack', implant: 'module' } as const;
  const slotOf = (kind: UiGearSlot['slot']): Slot => {
    const g = d?.gear.find((x) => x.slot === kind);
    return {
      key: kind, label: g?.label ?? kind, glyph: GLYPH[kind],
      item: g?.item ? { icon: g.item.id, name: g.item.name, count: g.item.count, note: g.item.natural ? '(natural)' : undefined, card: g.item.card } : null,
      action: kind === 'weapon' && g?.item && !g.item.natural ? { label: 'Stow', testId: 'gear-unequip', onClick: () => api.dispatch({ type: 'crew.unequip', id: c.id }) } : undefined,
    };
  };
  const stored = $derived<Slot[]>(c.arms.map((a) => ({
    key: `stored-${a.item}`, label: 'Hand weapon', glyph: 'sword', item: { icon: a.item, name: a.name, count: a.count, card: d?.cards[a.item] ?? null },
    action: { label: 'Equip', disabled: c.weapon?.item === a.item, testId: `gear-equip-${a.item}`, onClick: () => api.dispatch({ type: 'crew.equip', id: c.id, item: a.item }) },
  })));
</script>

{#if d}
  <Section title="Loadout" testId="crew-gear">
    <PaperDoll {api} carrying={slotOf('hands')} weapon={slotOf('weapon')} implant={slotOf('implant')} armor={slotOf('suit')} />
  </Section>
  {#if stored.length}
    <Section title="In storage on this ship" testId="crew-gear-nearby">
      <div class="stored">{#each stored as s (s.key)}<SlotBox {api} slot={s} caption={false} sub="{s.item?.count ?? 0} stored" cardAt="above" />{/each}</div>
    </Section>
  {/if}
{/if}

<style>
  .stored { display: flex; gap: 10px; }
</style>
