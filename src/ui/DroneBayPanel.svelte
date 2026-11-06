<script lang="ts">
  import type { UiDroneBay } from './api';

  /** The drone bay's slots in the module inspector: each docked or flying drone, its battery, and the AI core's limit (numbers on demand). */
  let { bay }: { bay: UiDroneBay } = $props();
</script>

<section data-testid="drone-bay">
  <div class="sub">Drones</div>
  {#each bay.slots as s, i (i)}
    {#if s}
      <div class="row"><span>{s.name}</span><span class="dim" class:bad={s.state === 'down'}>{s.doing}</span></div>
      <div class="bar" class:low={s.charge < 25}><i style:width="{s.charge}%"></i></div>
      {#if s.supply}<div class="row sup" data-testid="drone-supply"><span class="dim">Load</span><span class:bad={s.supply.have === 0}>{s.supply.name} {s.supply.have}/{s.supply.cap}</span></div>{/if}
    {:else}
      <div class="row"><span class="dim">Empty pad</span><span class="dim">takes a drone from storage</span></div>
    {/if}
  {/each}
  <div class="row cap" data-testid="drone-cap">
    <span class="dim">Out at once</span>
    {#if bay.cap > 0}<span>{bay.out} / {bay.cap} (AI core)</span>{:else}<span class="bad">no AI core: drones inert</span>{/if}
  </div>
</section>

<style>
  section { margin-top: 8px; }
  .sub { color: var(--dim); font-size: 12px; margin: 8px 0 4px; }
  .row { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 22px; }
  .dim { color: var(--dim); }
  .bad { color: var(--red); }
  .cap { margin-top: 6px; }
  .bar { height: 4px; background: var(--track); margin: 2px 0 6px; }
  .bar i { display: block; height: 100%; background: var(--cyan); }
  .bar.low i { background: var(--amber); }
</style>
