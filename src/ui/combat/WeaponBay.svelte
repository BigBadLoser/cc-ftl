<script lang="ts">
  import { Frame } from '../kit';
  import type { UiAiming, UiCombat } from '../api';
  import WeaponCard from './WeaponCard.svelte';
  import { weaponLabels } from './weaponNames';

  type Me = NonNullable<UiCombat['player']>;
  /**
   * The WEAPONS frame: four slots, a card for each weapon the ship has. With more than four weapons the cards go compact in two rows inside the
   * same frame height (Q W E R pick the first four; the rest are aimed by click).
   */
  let { me, aiming, onSelect, onMode, style = '' }: {
    me: Me;
    aiming: UiAiming | null;
    onSelect: (id: number) => void;
    onMode: (id: number, mode: 'auto' | 'hold') => void;
    style?: string;
  } = $props();
  const labels = $derived(weaponLabels(me.weapons));
  const dense = $derived(me.weapons.length > 4);
</script>

<Frame title="Weapons" {style}>
  <div class="cards" class:dense style:--cols={Math.ceil(me.weapons.length / 2)} data-testid="weapon-cards">
    {#each Array.from({ length: Math.max(4, me.weapons.length) }, (_, k) => k) as i (i)}
      {@const w = me.weapons[i]}
      {#if w}
        <WeaponCard
          weapon={w}
          label={labels[i] ?? w.name}
          hotkey={'QWER'[i] ?? ''}
          compact={dense}
          selected={aiming?.weapon === w.id}
          onSelect={() => onSelect(w.id)}
          onMode={(mode) => onMode(w.id, mode)}
        />
      {:else}
        <span class="empty">{i === 0 ? 'No weapons' : ''}</span>
      {/if}
    {/each}
  </div>
</Frame>

<style>
  .cards {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--gutter);
    grid-template-rows: 66px;
  }
  /* More than four: two compact rows in the same height, as many columns as it takes. Every weapon is shown and clickable. */
  .cards.dense {
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    grid-template-rows: repeat(2, minmax(0, 1fr));
    gap: 4px var(--gutter);
    height: 66px;
  }
  .empty {
    border: 1px dashed var(--line);
    display: grid;
    place-items: center;
    color: var(--dim);
    font-size: 12px;
  }
</style>
