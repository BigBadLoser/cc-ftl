<script lang="ts">
  import type { UiApi, UiFtl, UiModule } from '../api';
  import FtlCharge from '../FtlCharge.svelte';
  import Icon from '../Icon.svelte';
  import FabPanel from '../FabPanel.svelte';
  import RobotBayPanel from '../RobotBayPanel.svelte';
  import StoragePanel from '../StoragePanel.svelte';
  import { moduleState } from './state';

  /** The module Overview tab: state, power and health, the module's own panel (production, storage, bay, drive) and the orders. */
  let { api, m, ftl, onResearch, onPower }: { api: UiApi; m: UiModule; ftl: UiFtl | null; onResearch?: () => void; onPower: () => void } = $props();
  const power = (x: UiModule) => (x.power > 0 ? `+${x.power} supply` : x.power < 0 ? `${-x.power} draw` : 'none');
  const hpPct = (x: UiModule) => Math.round((x.hp / x.maxHp) * 100);
</script>

<div data-testid="module-overview">
    <dl>
      <dt>State</dt><dd data-testid="module-state" class:bad={!m.powered && m.power !== 0}>{moduleState(m)}</dd>
      <dt>Power</dt><dd>{power(m)}</dd>
      <dt>Health</dt><dd>{m.hp}/{m.maxHp}</dd>
      {#if m.suits}<dt>EVA suits</dt><dd data-testid="airlock-suits">{m.suits.stowed} / {m.suits.max}</dd>{/if}
    </dl>
    <div class="bar hp" class:low={hpPct(m) < 40}><i style:width="{hpPct(m)}%"></i></div>
    {#if m.def === 'module.helm' && ftl && ftl.ship === m.ship}<div class="drive"><FtlCharge {ftl} testid="helm-ftl" onCharge={() => api.dispatch({ type: 'ftl.charge', ship: m.ship })} onCancel={() => api.dispatch({ type: 'ftl.cancelCharge', ship: m.ship })} /></div>{/if}
    {#if m.crafting}<FabPanel {api} id={m.id} def={m.def} />{/if}
    {#if m.research}<button class="resbtn" data-testid="open-research" onclick={onResearch}><Icon name="research" size={18} /> Research projects</button>{/if}
    {#if m.storage}<StoragePanel {api} id={m.id} />{/if}
    {#if m.bay}<RobotBayPanel {api} id={m.id} bay={m.bay} />{/if}
    {#if m.hp < m.maxHp}
      <button class="prio" class:on={m.repairFirst} data-testid="dc-priority" aria-pressed={m.repairFirst} title={m.repairFirst ? 'First in the repair queue (click to undo)' : 'Crew repair this before anything else'} onclick={() => api.dispatch({ type: 'module.priorityRepair', id: m.id, on: !m.repairFirst })}><Icon name="chevUp" size={16} />Priority repair</button>
    {/if}
    <div class="btns">
      <button class="tile" class:on={m.enabled} title={m.enabled ? 'Enabled (click to disable)' : 'Disabled (click to enable)'} aria-label={m.enabled ? 'Disable' : 'Enable'} data-testid="toggle-enabled" onclick={() => api.dispatch({ type: 'module.setEnabled', id: m.id, enabled: !m.enabled })}><Icon name="power" size={20} /></button>
      {#if m.power < 0}<button class="pow" title="Power order: who keeps power when the ship is short" data-testid="open-power" onclick={onPower}>Power…</button>{/if}
      <button class="tile warn" title="Deconstruct" aria-label="Deconstruct" data-testid="deconstruct-module" onclick={() => { api.dispatch({ type: 'job.deconstructModule', ship: m.ship, x: m.x, y: m.y }); api.selectModule(null); }}><Icon name="trash" size={20} /></button>
    </div>
</div>

<style>
  .drive { margin: 0 0 8px; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; margin: 0 0 6px; }
  dt { color: var(--dim); } dd { margin: 0; text-align: right; }
  dd.bad { color: #ff9a9a; }
  .hp > i { background: var(--hp); } .hp.low > i { background: #ff5a2d; }
  .btns { display: flex; gap: 4px; margin-top: 10px; }
  .resbtn { display: flex; align-items: center; gap: 8px; width: 100%; margin-top: 8px; color: var(--amber); border-color: var(--amber); background: #000; justify-content: center; }
  .prio { display: flex; align-items: center; justify-content: center; gap: 4px; width: 100%; margin-top: 8px; min-height: 32px; }
  .prio.on { border-color: var(--amber); color: var(--amber); }
  .pow { padding: 0 10px; min-height: 36px; }
  .warn { border-color: #7a2a2a; color: var(--red); }
</style>
