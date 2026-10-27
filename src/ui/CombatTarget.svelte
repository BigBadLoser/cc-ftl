<script lang="ts">
  import Icon from './Icon.svelte';
  import type { UiShipCombat } from './api';
  import { resolveTarget } from './combatTarget';

  /** The ship-wide target: what every weapon without its own aim shoots at. */
  let { enemy, shipModuleId, hasTarget, onAim, aimingAll, onInView, shipTile }: {
    enemy: UiShipCombat; shipModuleId: number; hasTarget: boolean; onAim: (moduleId: number) => void; aimingAll: boolean; onInView: () => void; shipTile: { x: number; y: number } | null;
  } = $props();
  let open = $state(false);

  const targets = $derived(enemy.modules.filter((m) => m.kind !== 'other'));
  const tgt = $derived(resolveTarget(enemy, shipModuleId, null, shipTile));
  const pick = (id: number) => { onAim(id); open = false; };
</script>

<div class="tb" data-testid="combat-target">
  <div class="row">
    <span class="cap" title="Every weapon without its own target shoots at this">All weapons</span>
    <span class="name" title={tgt.label}><Icon name="target" size={14} /><span>{tgt.label}</span></span>
    <span class="int" class:low={tgt.pct < 35} title="Target integrity"><span class="bar" class:low={tgt.pct < 35}><i style="width:{tgt.pct}%"></i></span><b>{tgt.pct}%</b></span>
    <button class="tile" class:on={open} aria-expanded={open} title="Pick the ship-wide target module" aria-label="Pick the ship-wide target module" data-testid="combat-targets-toggle" onclick={() => (open = !open)}><Icon name="pick" size={16} /></button>
    <button class="tile" class:on={aimingAll} aria-pressed={aimingAll} title={aimingAll ? 'Click an enemy tile in the main view (right-click or Esc cancels)' : 'Target in view: click an enemy tile in the main view to aim every weapon'} aria-label="Target in view: all weapons" data-testid="combat-inview-all" onclick={onInView}><Icon name="frame" size={16} /></button>
  </div>

  {#if open}
    <div class="drop" role="group" aria-label="Targets">
      <button class="t whole" class:on={shipModuleId === 0 && hasTarget} onclick={() => pick(0)} title="Aim at the whole ship" aria-label="Whole ship"><Icon name="target" size={14} /><span>Whole ship</span></button>
      {#each targets as m (m.id)}
        {@const p = Math.round((m.hp / Math.max(1, m.maxHp)) * 100)}
        <button class:on={shipModuleId === m.id} class:dead={m.hp <= 0} class:hurt={p < 35} class="t {m.kind}" onclick={() => pick(m.id)} title="{m.name} {m.hp}/{m.maxHp}">
          <span class="nm">{m.name}{#if m.ion}<span class="ion"><Icon name="bolt" size={11} /></span>{/if}</span>
          <span class="bar"><i style="width:{p}%"></i></span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .tb { position: relative; background: #0b2433; padding: 4px 6px 4px 10px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); border-left: 3px solid var(--red); }
  .row { display: flex; align-items: center; gap: 8px; min-height: 32px; }
  .cap { font: 600 11px/1 var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); white-space: nowrap; }
  .cap::after { content: ' \2192'; }
  .name { flex: 1; min-width: 0; display: flex; align-items: center; gap: 5px; font: 600 16px/1.2 var(--head-font); letter-spacing: 0.03em; color: var(--text); }
  .name :global(svg) { color: var(--red); flex: none; }
  .name span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .int { display: inline-flex; align-items: center; gap: 5px; flex: none; }
  .int b { color: var(--amber); font-weight: 600; font-size: 12px; min-width: 32px; text-align: right; } .int.low b { color: var(--red); }
  .int .bar { width: 44px; }
  .bar { height: 5px; } .bar > i { background: var(--amber); } .bar.low > i { background: var(--red); }
  .tb > .row > button.tile { width: 32px; height: 32px; min-height: 0; min-width: 0; padding: 0; }
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
