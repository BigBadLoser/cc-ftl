<script lang="ts">
  import type { UiEnemyWeapon } from './api';

  /** The enemy's weapon charges: a bar each, with a notch where it commits its aim (a marker then shows on your ship) and red once it has. */
  let { weapons }: { weapons: UiEnemyWeapon[] } = $props();
</script>

{#if weapons.length > 0}
  <div class="chg" data-testid="enemy-charges" aria-label="Enemy weapon charge">
    {#each weapons as w (w.id)}
      <div class="w" class:hot={w.committed} class:off={w.stalled} title="{w.name}: {Math.round(w.charge * 100)}%{w.committed ? ', aimed at your ship' : ''}{w.stalled ? ' (offline)' : ''}">
        <span class="bar"><i style="width:{Math.round(w.charge * 100)}%"></i><u style="left:{Math.round(w.commitAt * 100)}%"></u></span>
      </div>
    {/each}
  </div>
{/if}

<style>
  .chg { display: flex; gap: 4px; padding-bottom: 6px; }
  .w { flex: 1 1 0; min-width: 0; }
  .bar { position: relative; display: block; height: 6px; background: var(--panel-3, #12384f); }
  .bar > i { display: block; height: 100%; background: var(--cyan); }
  .bar > u { position: absolute; top: -2px; bottom: -2px; width: 1px; background: var(--dim); }
  .hot .bar > i { background: var(--red); }
  .hot .bar { outline: 1px solid var(--red); }
  .off { opacity: 0.4; }
</style>
