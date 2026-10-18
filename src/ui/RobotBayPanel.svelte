<script lang="ts">
  import type { UiApi, UiRobotBay } from './api';

  let { api, id, bay }: { api: UiApi; id: number; bay: UiRobotBay } = $props();
  const busy = $derived(!!bay.assembling || !!bay.occupant);
</script>

<section data-testid="robot-bay">
  <div class="sub">Bay</div>
  {#if bay.assembling}
    <div class="row" data-testid="bay-assembling">
      <span>Assembling {bay.assembling.name}</span>
      <span class="dim">{bay.assembling.waiting ? 'waiting for parts' : `${Math.round(bay.assembling.progress * 100)}%`}</span>
    </div>
    <div class="bar"><i style:width="{Math.round(bay.assembling.progress * 100)}%"></i></div>
    <button class="warn full" data-testid="cancel-assembly" onclick={() => api.dispatch({ type: 'module.cancelAssembly', moduleId: id })}>Cancel assembly</button>
  {:else if bay.occupant}
    <div class="row" data-testid="bay-occupant">
      <button class="link" onclick={() => bay.occupant && api.selectCrew(bay.occupant.id, true)}>{bay.occupant.name}</button>
      <span class="dim">{bay.occupant.role}, {bay.occupant.charging ? 'charging' : 'out'}</span>
    </div>
    <div class="row"><span class="dim">Battery</span><span>{bay.occupant.charge}%</span></div>
    <div class="bar"><i style:width="{bay.occupant.charge}%"></i></div>
    {#if bay.occupant.maxHp}<div class="row"><span class="dim">Hull</span><span>{bay.occupant.hp}/{bay.occupant.maxHp}</span></div>{/if}
  {:else}
    <p class="dim">Empty.</p>
  {/if}
  {#if !busy}
    <div class="sub">Assemble a robot</div>
    <div class="opts" data-testid="assemble-options">
      {#each bay.options as o (o.role)}
        <button data-testid="assemble-{o.role}" onclick={() => api.dispatch({ type: 'module.assembleRobot', moduleId: id, role: o.role })}>
          <strong>{o.name}</strong>
          <small>{o.seconds}s</small>
          <span class="cost">
            {#each o.cost as c (c.item)}<span class:short={c.have < c.count}>{c.count} {c.name}</span>{/each}
          </span>
        </button>
      {/each}
    </div>
  {/if}
</section>

<style>
  section { margin-top: 8px; }
  .sub { color: var(--dim); font-size: 12px; margin: 8px 0 4px; }
  .row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .dim { color: var(--dim); }
  .full { width: 100%; margin-top: 6px; }
  .warn { border-color: #7a2a2a; }
  .link { min-height: 28px; padding: 0 6px; color: var(--cyan); }
  .opts { display: grid; gap: 4px; }
  .opts button { display: grid; grid-template-columns: 1fr auto; text-align: left; padding: 4px 10px; min-height: 48px; }
  .cost { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 11px; color: var(--dim); }
  .short { color: #ff9a9a; }
</style>
