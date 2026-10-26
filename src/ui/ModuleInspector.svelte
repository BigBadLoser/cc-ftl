<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiFtl, UiModule } from './api';
  import FtlCharge from './FtlCharge.svelte';
  import Icon from './Icon.svelte';
  import PanelHead from './PanelHead.svelte';
  import FabPanel from './FabPanel.svelte';
  import RobotBayPanel from './RobotBayPanel.svelte';
  import PowerPanel from './PowerPanel.svelte';
  import StoragePanel from './StoragePanel.svelte';

  let { api, onBack, onResearch }: { api: UiApi; onBack: () => void; onResearch?: () => void } = $props();
  let mods = $state<UiModule[]>([]);
  let sel = $state<number | null>(null);
  /** The Power… sub-view of the selected module; closes when another module is selected. */
  let powerOpen = $state(false);
  $effect(() => { void sel; powerOpen = false; });
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

{#if m && powerOpen && m.power < 0}
  <PowerPanel {api} {m} {mods} onBack={() => (powerOpen = false)} />
{:else if m}
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
    {#if m.research}<button class="resbtn" data-testid="open-research" onclick={onResearch}><Icon name="research" size={18} /> Research projects</button>{/if}
    {#if m.storage}<StoragePanel {api} id={m.id} />{/if}
    {#if m.bay}<RobotBayPanel {api} id={m.id} bay={m.bay} />{/if}
    <div class="btns">
      <button class="tile" class:on={m.enabled} title={m.enabled ? 'Enabled (click to disable)' : 'Disabled (click to enable)'} aria-label={m.enabled ? 'Disable' : 'Enable'} data-testid="toggle-enabled" onclick={() => api.dispatch({ type: 'module.setEnabled', id: m.id, enabled: !m.enabled })}><Icon name="power" size={20} /></button>
      {#if m.power < 0}<button class="pow" title="Power order: who keeps power when the ship is short" data-testid="open-power" onclick={() => (powerOpen = true)}>Power…</button>{/if}
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
  .btns { display: flex; gap: 4px; margin-top: 10px; }
  .resbtn { display: flex; align-items: center; gap: 8px; width: 100%; margin-top: 8px; color: var(--amber); border-color: var(--amber); background: #000; justify-content: center; }
  .pow { padding: 0 10px; min-height: 36px; }
  .warn { border-color: #7a2a2a; color: var(--red); }
</style>
