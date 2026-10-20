<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { UiApi, UiCombat, UiShipCombat } from './api';
  import CombatPlayer from './CombatPlayer.svelte';
  import ShipMeters from './ShipMeters.svelte';

  let { api, combat, onClose, onHail }: { api: UiApi; combat: UiCombat; onClose: () => void; onHail: (ship: number) => void } = $props();

  let expanded = $state(false);
  let viewEl: HTMLDivElement | undefined = $state();
  /** The enemy module last tapped, for per-weapon aiming ('' = whole ship). */
  let picked = $state(0);

  const enemy = $derived<UiShipCombat | undefined>(combat.enemies.find((e) => e.state === 'active' || e.state === 'disabled') ?? combat.enemies[0]);
  const me = $derived(combat.player);
  const aimed = $derived(me?.target && enemy && me.target.ship === enemy.ship ? me.target.moduleId : 0);
  const targets = $derived((enemy?.modules ?? []).filter((m) => m.kind !== 'other'));

  // A new hostile ship starts as the ship-wide target, so weapons fire without the player having to find the first tap.
  let autoAimed = 0;
  $effect(() => {
    if (me && enemy && enemy.state !== 'wreck' && !me.target && autoAimed !== enemy.ship) {
      autoAimed = enemy.ship;
      api.dispatch({ type: 'combat.setTarget', ship: me.ship, weaponId: null, targetShip: enemy.ship, targetModuleId: 0 });
    }
  });

  function aim(moduleId: number) {
    if (!me || !enemy) return;
    picked = moduleId;
    api.dispatch({ type: 'combat.setTarget', ship: me.ship, weaponId: null, targetShip: enemy.ship, targetModuleId: moduleId });
  }
  function tap(e: MouseEvent) {
    const hit = api.pickCombat(e.clientX, e.clientY);
    if (hit) aim(hit.moduleId);
  }

  // Tell the renderer where to draw the enemy ship: the transparent viewport element, followed every frame.
  let raf = 0;
  let last = '';
  function track() {
    raf = requestAnimationFrame(track);
    if (!viewEl || !enemy) {
      if (last) api.setCombatView(null);
      last = '';
      return;
    }
    const r = viewEl.getBoundingClientRect();
    const key = `${enemy.ship}|${r.left}|${r.top}|${r.width}|${r.height}`;
    if (key === last) return;
    last = key;
    api.setCombatView({ ship: enemy.ship, rect: { x: r.left, y: r.top, w: r.width, h: r.height } });
  }
  onMount(() => {
    raf = requestAnimationFrame(track);
  });
  onDestroy(() => {
    cancelAnimationFrame(raf);
    api.setCombatView(null);
  });
</script>

<section class="combat" class:expanded data-testid="combat-panel" aria-label="Combat">
  <header>
    <button class="grip" aria-label={expanded ? 'Collapse combat sheet' : 'Expand combat sheet'} onclick={() => (expanded = !expanded)}>{expanded ? '⌄' : '⌃'}</button>
    <strong>Combat</strong>
    <span class="sp"></span>
    {#if enemy}<button title="Call them on the radio: only ships that are not hostile answer" data-testid="combat-hail" onclick={() => { api.dispatch({ type: 'trade.hail', ship: enemy.ship }); onHail(enemy.ship); }}>Hail</button>{/if}
    <button title="Center the camera between the ships" onclick={() => api.focusFight(enemy?.ship ?? null)}>Frame</button>
    <button aria-label="Close combat panel" data-testid="combat-close" onclick={onClose}>×</button>
  </header>

  {#if enemy}
    <div class="top">
      <div class="enemy"><ShipMeters ship={enemy} label={enemy.name} compact /></div>
      <div class="viewbox">
        <div class="view" bind:this={viewEl} onclick={tap} role="presentation" data-testid="combat-view"></div>
      </div>

      <div class="targets" role="group" aria-label="Targets">
        <button class:on={aimed === 0 && !!me?.target} onclick={() => aim(0)}>Whole ship</button>
        {#each targets as m (m.id)}
          <button class:on={aimed === m.id} class:dead={m.hp <= 0} class="t {m.kind}" onclick={() => aim(m.id)} title="{m.name} {m.hp}/{m.maxHp}">
            {m.name}{m.ion ? ' ⚡' : ''}
            <span class="bar"><i style="width:{Math.round((m.hp / Math.max(1, m.maxHp)) * 100)}%"></i></span>
          </button>
        {/each}
      </div>
    </div>
  {:else}
    <p class="none">No hostile ships in range.</p>
  {/if}

  {#if me}<div class="scroll"><CombatPlayer {api} {me} {enemy} {picked} /></div>{/if}
</section>

<style>
  /* The page canvas shows through .view (the enemy ship is drawn there), so every other part paints its own background. */
  .combat {

    position: fixed; z-index: 7; display: flex; flex-direction: column; overflow: hidden;
    right: calc(8px + var(--sar)); top: max(calc(var(--hdr) + 8px + var(--sat)), calc(var(--alerts-h, 0px) + 88px + var(--sat))); bottom: calc(8px + var(--sab)); width: 372px; max-width: calc(100vw - 16px);
    border: 1px solid var(--line); border-radius: 10px;
  }
  header { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-bottom: 1px solid var(--line); background: var(--panel); }
  header button { min-height: 32px; min-width: 32px; padding: 0 8px; }
  .grip { display: none; }
  .sp { flex: 1; }
  .top { flex: none; }
  .viewbox { position: relative; padding: 8px; }
  .view { height: 236px; border-radius: 6px; cursor: crosshair; box-shadow: 0 0 0 8px var(--panel), inset 0 0 0 1px var(--line); }
  .enemy { padding: 8px 10px 0; background: var(--panel); }
  .targets { display: flex; flex-wrap: wrap; gap: 4px; padding: 0 8px 8px; background: var(--panel); }
  .targets button { min-height: 34px; min-width: 0; padding: 2px 8px; font-size: 12px; display: grid; gap: 2px; text-align: left; }
  .targets .bar { height: 3px; }
  .targets .t.weapon { border-left: 3px solid #e06a5c; }
  .targets .t.shield { border-left: 3px solid #4cc4e6; }
  .targets .t.engine { border-left: 3px solid #e0a040; }
  .targets .dead { opacity: 0.45; }
  .scroll { flex: 1; overflow-y: auto; padding: 8px; background: var(--panel); border-top: 1px solid var(--line); }
  .none { color: var(--dim); margin: 0; padding: 10px; background: var(--panel); }
  @media (max-width: 600px) {
    .combat { left: 0; right: 0; top: auto; bottom: 0; width: auto; max-width: none; height: 62vh; border-radius: 14px 14px 0 0; border-width: 1px 0 0; transition: height 0.18s; }
    .combat.expanded { height: calc(100vh - 12px - var(--sat)); }
    header { border-radius: 14px 14px 0 0; }
    .grip { display: inline-block; }
    .view { height: 26vh; }
    .expanded .view { height: 38vh; }
    .scroll { padding-bottom: calc(8px + var(--sab)); }
  }
</style>
