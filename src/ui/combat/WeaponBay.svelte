<script lang="ts">
  import { Frame } from '../kit';
  import type { UiAiming, UiCombat } from '../api';
  import WeaponCard from './WeaponCard.svelte';
  import { weaponLabels } from './weaponNames';

  type Me = NonNullable<UiCombat['player']>;
  /** The WEAPONS frame: four slots, a card for each weapon the ship has. */
  let { me, aiming, onSelect, style = '' }: {
    me: Me;
    aiming: UiAiming | null;
    onSelect: (id: number) => void;
    style?: string;
  } = $props();
  const labels = $derived(weaponLabels(me.weapons));
</script>

<Frame title="Weapons" {style}>
  <div class="cards">
    {#each [0, 1, 2, 3] as i (i)}
      {@const w = me.weapons[i]}
      {#if w}
        <WeaponCard
          weapon={w}
          label={labels[i] ?? w.name}
          hotkey={'QWER'[i] ?? ''}
          selected={aiming?.weapon === w.id}
          onSelect={() => onSelect(w.id)}
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
  .empty {
    border: 1px dashed var(--line);
    display: grid;
    place-items: center;
    color: var(--dim);
    font-size: 12px;
  }
</style>
