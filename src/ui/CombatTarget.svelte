<script lang="ts">
  import Icon from './Icon.svelte';
  import type { UiShipCombat, UiWeapon } from './api';

  let { enemy, aimed, hasTarget, weapon, shipTarget, onAim }: {
    enemy: UiShipCombat; aimed: number; hasTarget: boolean; weapon: UiWeapon | null; shipTarget: string; onAim: (moduleId: number) => void;
  } = $props();
  let open = $state(false);

  const targets = $derived(enemy.modules.filter((m) => m.kind !== 'other'));
  /** The block shows the selected weapon's own aim, else the ship-wide target. */
  const label = $derived(weapon ? (weapon.target ?? shipTarget) || 'Whole ship' : shipTarget || 'Whole ship');
  const mod = $derived(weapon ? enemy.modules.find((m) => m.name === weapon.target) : enemy.modules.find((m) => m.id === aimed));
  const pct = $derived(Math.round(((mod ? mod.hp / Math.max(1, mod.maxHp) : enemy.integrity) || 0) * 100));
  const pick = (id: number) => { onAim(id); open = false; };
</script>

<div class="tb" data-testid="combat-target">
  <div class="row">
    <div class="main">
      <span class="cap">{weapon ? `${weapon.name} target` : 'Current target'}</span>
      <span class="name"><Icon name="target" size={18} /><span>{label}</span></span>
    </div>
    <button class="tile" class:on={open} aria-expanded={open} title="Pick a target module" aria-label="Pick a target module" data-testid="combat-targets-toggle" onclick={() => (open = !open)}><Icon name="pick" size={18} /></button>
  </div>
  <div class="integ"><span class="cap">Target integrity</span><b class:low={pct < 35}>{pct}%</b></div>
  <div class="bar" class:low={pct < 35}><i style="width:{pct}%"></i></div>

  {#if open}
    <div class="drop" role="group" aria-label="Targets">
      <button class="t whole" class:on={aimed === 0 && hasTarget} onclick={() => pick(0)} title="Aim at the whole ship" aria-label="Whole ship"><Icon name="target" size={14} /><span>Whole ship</span></button>
      {#each targets as m (m.id)}
        {@const p = Math.round((m.hp / Math.max(1, m.maxHp)) * 100)}
        <button class:on={aimed === m.id} class:dead={m.hp <= 0} class:hurt={p < 35} class="t {m.kind}" onclick={() => pick(m.id)} title="{m.name} {m.hp}/{m.maxHp}">
          <span class="nm">{m.name}{#if m.ion}<span class="ion"><Icon name="bolt" size={11} /></span>{/if}</span>
          <span class="bar"><i style="width:{p}%"></i></span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .tb { position: relative; background: var(--panel); padding: 8px 10px; display: grid; gap: 4px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .row { display: flex; align-items: center; gap: 8px; }
  .main { flex: 1; min-width: 0; display: grid; }
  .cap { font: 600 11px/1.2 var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); }
  .name { display: flex; align-items: center; gap: 6px; font: 600 20px/1.2 var(--head-font); letter-spacing: 0.03em; color: var(--text); }
  .name :global(svg) { color: var(--red); }
  .name span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .integ { display: flex; justify-content: space-between; align-items: baseline; }
  .integ b { color: var(--amber); font-weight: 600; font-size: 13px; } .integ b.low { color: var(--red); }
  .bar { height: 6px; } .bar > i { background: var(--amber); } .bar.low > i { background: var(--red); }
  .drop { position: absolute; left: 0; right: 0; bottom: 100%; max-height: 190px; overflow-y: auto; display: flex; flex-wrap: wrap; gap: 4px; padding: 8px; background: var(--panel); border: 1px solid var(--line-hi); z-index: 2; }
  .drop button { min-height: 0; min-width: 0; padding: 3px 7px 4px; font-size: 12px; display: grid; gap: 3px; text-align: left; background: var(--panel-2); border-left: 3px solid var(--line); }
  .drop button.on { background: var(--panel-3); border-color: var(--cyan); color: #fff; }
  .drop .whole { display: inline-flex; align-items: center; gap: 5px; color: var(--cyan); } .drop .whole span { color: var(--text); }
  .drop .nm { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
  .drop .ion { color: var(--amber); display: inline-flex; }
  .drop .bar { height: 3px; } .drop .bar > i { background: var(--cyan); } .drop .hurt .bar > i { background: var(--red); }
  .drop .t.weapon { border-left-color: var(--red); } .drop .t.shield { border-left-color: var(--cyan); } .drop .t.engine { border-left-color: var(--amber); }
  .drop .dead { opacity: 0.45; }
</style>
