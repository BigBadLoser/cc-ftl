<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { UiApi, UiCombat, UiShipCombat } from './api';
  import CombatPlayer from './CombatPlayer.svelte';
  import Icon from './Icon.svelte';
  import CombatTarget from './CombatTarget.svelte';

  let { api, combat, onClose, onHail }: { api: UiApi; combat: UiCombat; onClose: () => void; onHail: (ship: number) => void } = $props();

  let expanded = $state(false);
  let viewEl: HTMLDivElement | undefined = $state();
  /** The enemy module last tapped, for per-weapon aiming ('' = whole ship). */
  let picked = $state(0);
  /** The weapon chosen for aiming (0 = none: picks aim the whole ship's target). */
  let selWeapon = $state(0);

  const enemy = $derived<UiShipCombat | undefined>(combat.enemies.find((e) => e.state === 'active' || e.state === 'disabled') ?? combat.enemies[0]);
  const me = $derived(combat.player);
  const aimed = $derived(me?.target && enemy && me.target.ship === enemy.ship ? me.target.moduleId : 0);
  const sel = $derived(me?.weapons.find((w) => w.id === selWeapon) ?? null);
  /** Short state-driven status for the header pill, from what the panel already reads. */
  const pill = $derived.by((): { text: string; tone: string } => {
    if (!enemy) return { text: 'Clear', tone: 'dim' };
    switch (enemy.state) {
      case 'disabled': return { text: 'Target disabled', tone: 'amber' };
      case 'wreck': return { text: 'Wreck', tone: 'dim' };
      case 'prize': return { text: 'Prize', tone: 'green' };
      case 'fled': return { text: 'Enemy fled', tone: 'dim' };
    }
    if (!me) return { text: 'Hostile', tone: 'red' };
    if (me.hold) return { text: 'Holding fire', tone: 'amber' };
    if (enemy.shield.max > 0 && enemy.shield.layers === 0) return { text: 'Shields down', tone: 'green' };
    if (me.weapons.length === 0) return { text: 'No weapons', tone: 'dim' };
    if (me.weapons.some((w) => w.charge >= 1 && w.powered && !w.ion)) return { text: 'Engaging', tone: 'red' };
    return { text: 'Charging weapons', tone: 'amber' };
  });

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
    const weaponId = selWeapon && me.weapons.some((w) => w.id === selWeapon) ? selWeapon : null;
    api.dispatch({ type: 'combat.setTarget', ship: me.ship, weaponId, targetShip: enemy.ship, targetModuleId: moduleId });
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
  <button class="handle" title={expanded ? 'Collapse combat sheet' : 'Expand combat sheet'} aria-label={expanded ? 'Collapse combat sheet' : 'Expand combat sheet'} onclick={() => (expanded = !expanded)}><i></i></button>
  <header class="ph">
    <span class="ico"><Icon name="target" size={18} /></span>
    <span class="t">{enemy ? enemy.name : 'Combat'}</span>
    {#if enemy}<span class="pillst {pill.tone}" data-testid="combat-state">{pill.text}</span>{/if}
    <button class="tile" title="Frame: center the camera between the ships" aria-label="Frame" onclick={() => api.focusFight(enemy?.ship ?? null)}><Icon name="frame" size={18} /></button>
    <button class="tile x" title="Close combat panel" aria-label="Close combat panel" data-testid="combat-close" onclick={onClose}><Icon name="close" size={16} /></button>
  </header>

  {#if enemy}
    {@const hullPct = Math.round(enemy.integrity * 100)}
    <div class="top">
      <div class="enemy" data-testid="ship-meters">
        <div class="stats">
          <span class="st" title="Shield layers" aria-label="Shield {enemy.shield.layers} of {enemy.shield.max}"><Icon name="shield" size={16} /><b data-testid="shield-pips">{enemy.shield.layers} / {enemy.shield.max}</b></span>
          <span class="st" class:low={hullPct < 35} title="Hull integrity"><Icon name="hull" size={16} /><b>{hullPct}%</b><em>Hull</em></span>
          <span class="st" title="Chance an incoming shot misses"><Icon name="evasion" size={16} /><b>{Math.round(enemy.evasion * 100)}%</b><em>Evade</em></span>
        </div>
        <div class="bar hull" class:low={hullPct < 35}><i style="width:{hullPct}%"></i></div>
      </div>
      <div class="viewbox">
        <div class="view" bind:this={viewEl} onclick={tap} role="presentation" data-testid="combat-view"></div>
      </div>
      <CombatTarget {enemy} {aimed} hasTarget={!!me?.target} weapon={sel} shipTarget={me?.target?.label ?? ''} onAim={aim} />
    </div>
  {:else}
    <p class="none">No hostile ships in range.</p>
  {/if}

  {#if me}<CombatPlayer {api} {me} {enemy} {picked} {selWeapon} onSelect={(id) => (selWeapon = id)} {onHail} />{/if}
</section>

<style>
  /* The page canvas shows through .view (the enemy ship is drawn there), so every other part paints its own background. */
  .combat {
    position: fixed; z-index: 7; display: flex; flex-direction: column; overflow: hidden;
    right: calc(8px + var(--sar)); top: max(calc(var(--hdr) + 8px + var(--sat)), calc(var(--rcol-h, 0px) + 16px + var(--sat))); bottom: calc(8px + var(--sab)); width: 372px; max-width: calc(100vw - 16px);
    border: 1px solid var(--line-hi); border-radius: 0;
  }
  .handle { display: none; }
  header.ph { margin: 0; padding: 0 0 0 10px; display: flex; align-items: center; gap: 8px; min-height: 32px; flex: none; }
  header .ico { display: inline-flex; color: var(--cyan); }
  header .t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  header button.tile { width: 32px; height: 32px; border-width: 0 0 0 1px; background: #0a3a52; color: #fff; }
  header button.tile:hover { background: var(--panel-3); }
  .pillst { font: 600 11px/1 var(--head-font); letter-spacing: 0.06em; white-space: nowrap; flex: none; text-transform: uppercase; padding: 3px 6px; border: 1px solid currentColor; }
  .pillst.red { color: #ff8a8a; background: #3a1216; } .pillst.amber { color: var(--amber); } .pillst.green { color: var(--green); } .pillst.dim { color: var(--dim); }
  .top { flex: none; }
  .enemy { background: var(--panel); padding: 8px 10px 0; display: grid; gap: 5px; }
  .stats { display: flex; align-items: center; gap: 14px; }
  .st { display: inline-flex; align-items: center; gap: 5px; color: var(--cyan); font-size: 13px; }
  .st b { color: var(--text); font-weight: 600; }
  .st em { font-style: normal; color: var(--dim); font-size: 12px; }
  .st.low b { color: var(--red); }
  .bar.hull { height: 6px; } .bar.hull.low > i { background: var(--red); }
  .viewbox { position: relative; padding: 8px; }
  .view { height: 190px; cursor: crosshair; box-shadow: 0 0 0 8px var(--panel), inset 0 0 0 1px var(--line); }
  .none { background: var(--panel); color: var(--dim); margin: 0; padding: 10px; }
  @media (min-width: 601px) and (max-height: 860px) { .view { height: 104px; } }
  @media (max-width: 600px) {
    .combat { left: 0; right: 0; top: auto; bottom: 0; width: auto; max-width: none; height: 55vh; border-width: 1px 0 0; transition: height 0.18s; }
    .combat.expanded { height: calc(100vh - 12px - var(--sat)); }
    .handle { display: flex; justify-content: center; align-items: center; height: 16px; min-height: 16px; width: 100%; padding: 0; border: 0; background: var(--panel-2); flex: none; }
    .handle i { width: 40px; height: 4px; background: var(--line-hi); }
    .view { height: 9vh; }
    .expanded .view { height: 30vh; }
  }
</style>
