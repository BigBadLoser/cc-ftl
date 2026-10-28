<script lang="ts">
  import type { UiApi, UiHazard, UiModule } from './api';
  import Icon from './Icon.svelte';

  /**
   * One-click damage control for what the selection shows: fight a fire or seal a breach in the room, repair a damaged
   * module, move it to the top of the repair queue. Each button is a sim command; the sim picks the nearest able crew member.
   */
  let { api, ship, hazard, module = null }: { api: UiApi; ship: number; hazard: UiHazard; module?: UiModule | null } = $props();

  const damaged = $derived(!!module && module.hp < module.maxHp);
  const what = $derived([hazard.fire ? 'Fire' : '', hazard.breach ? 'Hull breach' : '', damaged ? 'Damaged' : ''].filter(Boolean).join(' · '));
</script>

{#if what}
  <div class="dc" data-testid="damage-control">
    <p class="msg"><Icon name="alert" size={16} />{what}</p>
    <div class="group">
      {#if hazard.fire}
        <button data-testid="dc-fire" title="Send the nearest able crew member to put the fire out" onclick={() => api.dispatch({ type: 'damage.fightFire', ship, room: hazard.room })}><Icon name="fire" size={16} />Fight fire</button>
      {/if}
      {#if hazard.breach}
        <button data-testid="dc-breach" title="Send the nearest able crew member (suited if the air is thin) to wall up the hole" onclick={() => api.dispatch({ type: 'damage.sealBreach', ship, room: hazard.room })}><Icon name="wrench" size={16} />Seal breach</button>
      {/if}
      {#if module && damaged}
        <button data-testid="dc-repair" title="Send the nearest able crew member to repair it" onclick={() => api.dispatch({ type: 'damage.repair', module: module.id })}><Icon name="wrench" size={16} />Repair</button>
        <button class:on={module.repairFirst} data-testid="dc-priority" aria-pressed={module.repairFirst} title={module.repairFirst ? 'First in the repair queue (click to undo)' : 'Repair this before anything else'} onclick={() => api.dispatch({ type: 'module.priorityRepair', id: module.id, on: !module.repairFirst })}><Icon name="chevUp" size={16} />Priority</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .dc { display: grid; gap: 6px; margin: 0 0 8px; padding: 8px; background: var(--panel-2); border: 1px solid var(--amber); }
  .msg { display: flex; align-items: center; gap: 4px; margin: 0; font-size: 12px; color: var(--amber); }
  .group { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 4px; }
  button { display: flex; align-items: center; justify-content: center; gap: 4px; min-height: 32px; padding: 0 10px; }
  button.on { border-color: var(--amber); color: var(--amber); }
</style>
