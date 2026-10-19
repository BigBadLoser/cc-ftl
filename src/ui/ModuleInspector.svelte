<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiModule } from './api';
  import FabPanel from './FabPanel.svelte';
  import RobotBayPanel from './RobotBayPanel.svelte';
  import StoragePanel from './StoragePanel.svelte';

  let { api }: { api: UiApi } = $props();
  let mods = $state<UiModule[]>([]);
  let sel = $state<number | null>(null);
  const m = $derived(mods.find((x) => x.id === sel));

  onMount(() => {
    const a = api.modules.subscribe((v) => (mods = v));
    const b = api.selectedModule.subscribe((s) => (sel = s));
    return () => (a(), b());
  });

  const stateOf = (x: UiModule) => (!x.enabled ? 'Disabled' : x.hp <= 0 ? 'Destroyed' : x.powered ? 'Running' : 'No power');
  const power = (x: UiModule) => (x.power > 0 ? `+${x.power} supply` : x.power < 0 ? `${-x.power} draw` : 'none');
  const hpPct = (x: UiModule) => Math.round((x.hp / x.maxHp) * 100);
</script>

{#if m}
  <aside class="sheet" class:wide={m.crafting || m.storage} data-testid="module-inspector">
    <h2>{m.name} <small>{m.x},{m.y}</small></h2>
    <dl>
      <dt>State</dt><dd data-testid="module-state" class:bad={!m.powered && m.power !== 0}>{stateOf(m)}</dd>
      <dt>Power</dt><dd>{power(m)}</dd>
      <dt>Health</dt><dd>{m.hp}/{m.maxHp}</dd>
      {#if m.suits}<dt>EVA suits</dt><dd data-testid="airlock-suits">{m.suits.stowed} / {m.suits.max}</dd>{/if}
    </dl>
    <div class="bar hp" class:low={hpPct(m) < 40}><i style:width="{hpPct(m)}%"></i></div>
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
      <button class:on={m.enabled} data-testid="toggle-enabled" onclick={() => api.dispatch({ type: 'module.setEnabled', id: m.id, enabled: !m.enabled })}>
        {m.enabled ? 'Enabled' : 'Disabled'}
      </button>
      <button class="warn" data-testid="deconstruct-module" onclick={() => { api.dispatch({ type: 'job.deconstructModule', gridId: 1, x: m.x, y: m.y }); api.selectModule(null); }}>Deconstruct</button>
    </div>
  </aside>
{/if}

<style>
  aside { left: calc(8px + var(--sal)); bottom: calc(8px + var(--sab)); width: 260px; max-height: calc(100vh - var(--hdr) - 24px); overflow-y: auto; }
  aside.wide { width: 340px; }
  h2 { margin: 0 0 6px; font-size: 15px; color: var(--cyan); }
  h2 small { color: var(--dim); font-weight: normal; margin-left: 6px; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; margin: 0 0 6px; }
  dt { color: var(--dim); } dd { margin: 0; text-align: right; }
  dd.bad { color: #ff9a9a; }
  .hp > i { background: #4cd964; } .hp.low > i { background: #ff5a2d; }
  .row { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; gap: 8px; }
  .lbl { color: var(--dim); }
  .prio { display: flex; gap: 4px; }
  .prio button { min-width: 36px; padding: 0; }
  .btns { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 10px; }
  .warn { border-color: #7a2a2a; }
  @media (max-width: 600px) { aside, aside.wide { width: auto; left: 0; bottom: 0; max-height: 62vh; } }
</style>
