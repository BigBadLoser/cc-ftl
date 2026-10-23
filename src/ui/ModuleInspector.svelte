<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiFtl, UiModule } from './api';
  import FtlCharge from './FtlCharge.svelte';
  import Icon from './Icon.svelte';
  import PanelHead from './PanelHead.svelte';
  import FabPanel from './FabPanel.svelte';
  import RobotBayPanel from './RobotBayPanel.svelte';
  import StoragePanel from './StoragePanel.svelte';

  let { api, onBack }: { api: UiApi; onBack: () => void } = $props();
  let mods = $state<UiModule[]>([]);
  let sel = $state<number | null>(null);
  let ftl = $state<UiFtl | null>(null);
  const m = $derived(mods.find((x) => x.id === sel));

  onMount(() => {
    const a = api.modules.subscribe((v) => (mods = v));
    const b = api.selectedModule.subscribe((s) => (sel = s));
    const c = api.ftl.subscribe((v) => (ftl = v));
    return () => (a(), b(), c());
  });

  const stateOf = (x: UiModule) => (!x.enabled ? 'Disabled' : x.hp <= 0 ? 'Destroyed' : x.powered ? 'Running' : 'No power');
  const power = (x: UiModule) => (x.power > 0 ? `+${x.power} supply` : x.power < 0 ? `${-x.power} draw` : 'none');
  const hpPct = (x: UiModule) => Math.round((x.hp / x.maxHp) * 100);
</script>

{#if m}
  <div data-testid="module-inspector">
    <PanelHead icon="module" title={m.name} sub="{m.local.x},{m.local.y}" {onBack} />
    <dl>
      <dt>State</dt><dd data-testid="module-state" class:bad={!m.powered && m.power !== 0}>{stateOf(m)}</dd>
      <dt>Power</dt><dd>{power(m)}</dd>
      <dt>Health</dt><dd>{m.hp}/{m.maxHp}</dd>
      {#if m.suits}<dt>EVA suits</dt><dd data-testid="airlock-suits">{m.suits.stowed} / {m.suits.max}</dd>{/if}
    </dl>
    <div class="bar hp" class:low={hpPct(m) < 40}><i style:width="{hpPct(m)}%"></i></div>
    {#if m.def === 'module.helm' && ftl && ftl.ship === m.ship}<div class="drive"><FtlCharge {ftl} testid="helm-ftl" onCharge={() => api.dispatch({ type: 'ftl.charge', ship: m.ship })} onCancel={() => api.dispatch({ type: 'ftl.cancelCharge', ship: m.ship })} /></div>{/if}
    {#if m.crafting}<FabPanel {api} id={m.id} def={m.def} />{/if}
    {#if m.storage}<StoragePanel {api} id={m.id} />{/if}
    {#if m.bay}<RobotBayPanel {api} id={m.id} bay={m.bay} />{/if}
    {#if m.power !== 0}
      <div class="row">
        <span class="lbl">Priority</span>
        <span class="prio">
          {#each [1, 2, 3, 4, 5] as p (p)}
            <button class:on={m.priority === p} data-testid="prio-{p}" onclick={() => api.dispatch({ type: 'module.setPriority', id: m.id, priority: p })}>{p}</button>
          {/each}
        </span>
      </div>
    {/if}
    <div class="btns">
      <button class="tile" class:on={m.enabled} title={m.enabled ? 'Enabled (click to disable)' : 'Disabled (click to enable)'} aria-label={m.enabled ? 'Disable' : 'Enable'} data-testid="toggle-enabled" onclick={() => api.dispatch({ type: 'module.setEnabled', id: m.id, enabled: !m.enabled })}><Icon name="power" size={20} /></button>
      <button class="tile warn" title="Deconstruct" aria-label="Deconstruct" data-testid="deconstruct-module" onclick={() => { api.dispatch({ type: 'job.deconstructModule', ship: m.ship, x: m.x, y: m.y }); api.selectModule(null); }}><Icon name="trash" size={20} /></button>
    </div>
  </div>
{/if}

<style>
  .drive { margin: 0 0 8px; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; margin: 0 0 6px; }
  dt { color: var(--dim); } dd { margin: 0; text-align: right; }
  dd.bad { color: #ff9a9a; }
  .hp > i { background: var(--hp); } .hp.low > i { background: #ff5a2d; }
  .row { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; gap: 8px; }
  .lbl { color: var(--dim); }
  .prio { display: flex; gap: 2px; }
  .prio button { min-width: 36px; padding: 0; }
  .btns { display: flex; gap: 4px; margin-top: 10px; }
  .warn { border-color: #7a2a2a; color: var(--red); }
</style>
