<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiModule } from '../api';
  import Icon from '../Icon.svelte';
  import { ActionButton, Frame } from '../kit';

  /**
   * Combat only: your ship is in the main view and a module of it is clicked. Shows its name and health and the one damage-control lever,
   * Priority repair (the full inspector is hidden during a fight). Esc (the controller's deselect) closes it.
   */
  let { api, ship }: { api: UiApi; ship: number } = $props();
  let mods = $state<UiModule[]>([]);
  let sel = $state<number | null>(null);
  const m = $derived(mods.find((x) => x.id === sel && x.ship === ship));
  const pct = $derived(m ? Math.round((m.hp / Math.max(1, m.maxHp)) * 100) : 0);

  onMount(() => {
    const a = api.modules.subscribe((v) => (mods = v));
    const b = api.selectedModule.subscribe((s) => (sel = s));
    return () => (a(), b());
  });
</script>

{#if m}
  <div class="quick" data-testid="module-quick">
    <Frame title={m.name}>
      <div class="body">
        <div class="row"><span class="dim">Health</span><span>{m.hp}/{m.maxHp}</span></div>
        <div class="bar" class:low={pct < 40}><i style:width="{pct}%"></i></div>
        {#if m.hp < m.maxHp}
          <ActionButton
            tone={m.repairFirst ? 'amber' : 'plain'}
            title={m.repairFirst ? 'First in the repair queue (click to undo)' : 'Crew repair this before anything else'}
            testid="dc-priority"
            onclick={() => api.dispatch({ type: 'module.priorityRepair', id: m.id, on: !m.repairFirst })}
          ><Icon name="chevUp" size={16} />Priority repair</ActionButton>
        {:else}
          <div class="dim ok">Undamaged</div>
        {/if}
      </div>
    </Frame>
  </div>
{/if}

<style>
  .quick { pointer-events: auto; width: 220px; background: var(--panel); }
  .body { display: flex; flex-direction: column; gap: 6px; padding: 10px; }
  .row { display: flex; justify-content: space-between; }
  .dim { color: var(--dim); }
  .ok { text-align: center; }
  .bar { height: 6px; background: var(--panel-3); }
  .bar > i { display: block; height: 100%; background: var(--hp); }
  .bar.low > i { background: #ff5a2d; }
</style>
