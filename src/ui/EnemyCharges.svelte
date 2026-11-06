<script lang="ts">
  import { Meter } from './kit';
  import type { UiEnemyWeapon } from './api';

  /** The enemy's weapon charges: a bar each, with a notch where it commits its aim (a marker then shows on your ship) and red once it has. */
  let { weapons }: { weapons: UiEnemyWeapon[] } = $props();
</script>

{#if weapons.length > 0}
  <div class="chg" data-testid="enemy-charges" aria-label="Enemy weapon charge">
    {#each weapons as w (w.id)}
      <div class="w" class:hot={w.committed} class:off={w.stalled} title="{w.name}: {Math.round(w.charge * 100)}%{w.committed ? ', aimed at your ship' : ''}{w.stalled ? ' (offline)' : ''}">
        <Meter value={w.charge} tone={w.committed ? 'bad' : 'neutral'} height={6} notches={[w.commitAt]} edge={w.committed ? 'var(--red)' : 'var(--line)'} />
      </div>
    {/each}
  </div>
{/if}

<style>
  .chg { display: flex; gap: 4px; padding-bottom: 6px; }
  .w { flex: 1 1 0; min-width: 0; }
  .off { opacity: 0.4; }
</style>
