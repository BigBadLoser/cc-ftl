<script lang="ts">
  import PaneHeader from './comms/PaneHeader.svelte';
  import type { Service, ServiceId } from './stationChannel';

  /** The services as decision buttons: the open one is cyan (actionable), Trade has an arrow because it opens its own window. */
  let { services, active, onpick }: { services: Service[]; active: ServiceId; onpick: (id: ServiceId) => void } = $props();
</script>

<PaneHeader label="SERVICES" />
<div class="list">
  {#each services as s (s.id)}
    <button class:on={s.id === active} data-testid="station-tab-{s.id}" aria-pressed={s.id === active} onclick={() => onpick(s.id)}>
      <span class="l">{s.label}{s.opens ? ' ↗' : ''}</span><small>{s.note}</small>
    </button>
  {/each}
</div>

<style>
  .list { display: grid; gap: 8px; padding: 10px; }
  button { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 9px 12px; min-height: 0; border: 1px solid var(--line-hi); border-radius: 0; background: transparent; color: var(--text); cursor: pointer; text-align: left; }
  button:hover { background: rgba(255, 255, 255, 0.05); }
  button.on { border-color: var(--cyan); color: var(--cyan); background: rgba(54, 212, 255, 0.08); }
  .l { font: 700 14px var(--head-font); letter-spacing: 0.1em; text-transform: uppercase; }
  small { font-size: 12px; color: var(--dim); }
</style>
