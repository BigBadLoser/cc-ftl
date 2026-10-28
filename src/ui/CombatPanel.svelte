<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { UiAiming, UiApi, UiCombat, UiShipCombat } from './api';
  import CombatPlayer from './CombatPlayer.svelte';
  import EnemyCharges from './EnemyCharges.svelte';
  import Icon from './Icon.svelte';
  import CombatTarget from './CombatTarget.svelte';
  import FloatingWindow from './FloatingWindow.svelte';
  import { combatRight } from './combatDock';
  import { setDragCursor } from './dragCursor';
  import { readNumber, splitFraction, writeNumber, type Bounds, type Rect } from './floatingWindow';

  let { api, combat, onClose, onHail, onFlee }: { api: UiApi; combat: UiCombat; onClose: () => void; onHail: (ship: number) => void; onFlee: (ship: number) => void } = $props();

  let viewEl: HTMLCanvasElement | undefined = $state();
  /** The weapon chosen for aiming (0 = none: picks aim the whole ship's target). */
  let selWeapon = $state(0);
  /** "Target in view" armed: the next left-click on the enemy in the main view aims (a weapon id, null = every weapon). */
  let aiming = $state<UiAiming | null>(null);

  const enemy = $derived<UiShipCombat | undefined>(combat.enemies.find((e) => e.state === 'active' || e.state === 'disabled') ?? combat.enemies[0]);
  const me = $derived(combat.player);
  const aimed = $derived(me?.target && enemy && me.target.ship === enemy.ship ? me.target.moduleId : 0);
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

  /** Aim the selected weapon (viewport taps), or the whole ship's target when `shipWide` or no weapon is selected. */
  function aim(moduleId: number, shipWide = false) {
    if (!me || !enemy) return;
    const weaponId = !shipWide && selWeapon && me.weapons.some((w) => w.id === selWeapon) ? selWeapon : null;
    if (weaponId) selWeapon = 0;
    api.dispatch({ type: 'combat.setTarget', ship: me.ship, weaponId, targetShip: enemy.ship, targetModuleId: moduleId });
  }
  function tap(e: MouseEvent) {
    const hit = api.pickCombat(e.clientX, e.clientY);
    if (hit) aim(hit.moduleId);
  }

  // Target brackets over the enemy's modules: hover from the pointer (same pick as a tap), the rest from the snapshot.
  let hover = $state(0);
  function move(e: PointerEvent) {
    hover = e.pointerType === 'touch' ? 0 : (api.pickCombat(e.clientX, e.clientY)?.moduleId ?? 0);
  }
  $effect(() => {
    api.setCombatMarks({
      shipTarget: aimed || undefined,
      overrides: me?.weapons.filter((w) => w.targetModuleId !== 0).map((w) => w.targetModuleId) ?? [],
      hover: hover || undefined,
      arming: selWeapon !== 0,
    });
  });

  // The enemy ship is drawn into the view's own canvas by the renderer, every frame (it reads the canvas's place on the page
  // itself, so dragging, resizing and the splitter need nothing here): opaque, stacked like any other part of the panel.
  const viewShip = $derived(enemy?.ship ?? 0);
  $effect(() => {
    const el = viewEl;
    const ship = viewShip;
    api.setCombatView(el && ship ? { ship, canvas: el } : null);
  });
  onMount(() => api.aiming.subscribe((a) => (aiming = a)));

  // Floating window: left-docked by default, where the screen is mostly empty. The panels that step aside for it follow its real
  // right edge (--combat-right) while it sits on the left; once the player drags it elsewhere they go back to their normal spots (data-combat-free).
  const WIDTH = 420;
  const defaultRect = (b: Bounds): Rect => ({ x: b.left, y: b.top, w: WIDTH, h: b.bottom - b.top });
  const root = document.documentElement;
  /** Undocked, the panel draws above every other panel, card and toast (not above the modals and overlays). */
  let free = $state(false);
  function layout(r: Rect) {
    const docked = r.x <= 24;
    free = !docked;
    combatRight.set(docked ? r.x + r.w + 8 : 0);
    root.toggleAttribute('data-combat-free', !docked);
    if (docked) root.style.setProperty('--combat-right', `${r.x + r.w + 8}px`);
    else root.style.removeProperty('--combat-right');
  }
  onDestroy(() => {
    combatRight.set(0);
    root.removeAttribute('data-combat-free');
    root.style.removeProperty('--combat-right');
  });

  // Splitter between the ship view and the weapons list: the share of the body the view gets, remembered for the session.
  const SPLIT_KEY = 'cc.window.combat.split';
  const MIN_VIEW = 190;
  const MIN_WEAPONS = 120;
  let split = $state(readNumber(SPLIT_KEY, 6 / 11));
  let bodyEl: HTMLDivElement | undefined = $state();
  let splitting = false;
  function splitDown(e: PointerEvent) {
    if (e.button !== 0) return;
    splitting = true;
    setDragCursor('row-resize');
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function splitMove(e: PointerEvent) {
    if (!splitting || !bodyEl) return;
    const r = bodyEl.getBoundingClientRect();
    split = splitFraction(e.clientY - r.top, r.height, MIN_VIEW, MIN_WEAPONS);
  }
  function splitUp() {
    if (!splitting) return;
    splitting = false;
    setDragCursor(null);
    writeNumber(SPLIT_KEY, split);
  }
  function splitKey(e: KeyboardEvent) {
    if (!bodyEl || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const h = bodyEl.getBoundingClientRect().height;
    split = splitFraction(split * h + (e.key === 'ArrowUp' ? -24 : 24), h, MIN_VIEW, MIN_WEAPONS);
    writeNumber(SPLIT_KEY, split);
  }
  onDestroy(() => {
    api.setAiming(null);
    api.setCombatView(null);
  });
</script>

<FloatingWindow id="combat" title={enemy ? enemy.name : 'Combat'} icon="target" min={{ w: 300, h: 420 }} {defaultRect} {onClose} onLayout={layout}
  closeLabel="Close combat panel" closeTestId="combat-close" testId="combat-panel" bg={false} avoidCombat={false} z={free ? 10 : 7} class="combat">
  {#snippet titleExtra()}
    {#if enemy}<span class="pillst {pill.tone}" data-testid="combat-state">{pill.text}</span>{/if}
  {/snippet}
  {#snippet actions()}
    <button class="tile" title="Frame: center the camera between the ships" aria-label="Frame" onclick={() => api.focusFight(enemy?.ship ?? null)}><Icon name="frame" size={18} /></button>
  {/snippet}
  <div class="body" bind:this={bodyEl}>
  {#if enemy}
    {@const hullPct = Math.round(enemy.integrity * 100)}
    <div class="top" style="flex-grow:{split * 100}">
      <div class="enemy" data-testid="ship-meters">
        <div class="stats">
          <span class="st" title="Shield layers" aria-label="Shield {enemy.shield.layers} of {enemy.shield.max}"><Icon name="shield" size={16} /><b data-testid="shield-pips">{enemy.shield.layers} / {enemy.shield.max}</b></span>
          <span class="st" class:low={hullPct < 35} title="Hull integrity"><Icon name="hull" size={16} /><b>{hullPct}%</b><em>Hull</em></span>
          <span class="st" title="Chance an incoming shot misses"><Icon name="evasion" size={16} /><b>{Math.round(enemy.evasion * 100)}%</b><em>Evade</em></span>
        </div>
        <div class="bar hull" class:low={hullPct < 35}><i style="width:{hullPct}%"></i></div>
        <EnemyCharges weapons={enemy.charges ?? []} />
      </div>
      <div class="viewbox">
        <canvas class="view" bind:this={viewEl} onclick={tap} onpointermove={move} onpointerleave={() => (hover = 0)} data-testid="combat-view"></canvas>
      </div>
      <CombatTarget {enemy} shipModuleId={aimed} hasTarget={!!me?.target} onAim={(id) => aim(id, true)} shipTile={me?.target?.tile ?? null} aimingAll={aiming !== null && aiming.weapon === null} onInView={() => api.setAiming(aiming && aiming.weapon === null ? null : { weapon: null })} />
    </div>
  {:else}
    <p class="none">No hostile ships in range.</p>
  {/if}

  {#if me}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    {#if enemy}<div class="split" role="separator" aria-orientation="horizontal" aria-label="Resize the ship view" tabindex="0" data-testid="combat-split" onpointerdown={splitDown} onpointermove={splitMove} onpointerup={splitUp} onpointercancel={splitUp} onkeydown={splitKey}><i></i></div>{/if}
    <div class="low" style="flex-grow:{(1 - split) * 100}"><CombatPlayer {api} {me} {enemy} {selWeapon} {aiming} onSelect={(id) => (selWeapon = id)} {onHail} {onFlee} /></div>
  {/if}
  </div>
</FloatingWindow>

<style>
  /* A floating window (FloatingWindow): left-docked by default, where the screen is mostly empty, so the right column (log, goals, jobs, alerts) and the tool dock stay clear. */
  /* .view is a canvas the renderer copies the enemy ship into each frame (opaque; the panel's other parts paint their own background). */
  .pillst { font: 600 11px/1 var(--head-font); letter-spacing: 0.06em; white-space: nowrap; flex: none; text-transform: uppercase; padding: 3px 6px; border: 1px solid currentColor; }
  .pillst.red { color: #ff8a8a; background: #3a1216; } .pillst.amber { color: var(--amber); } .pillst.green { color: var(--green); } .pillst.dim { color: var(--dim); }
  .body { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; }
  .top { flex: 1 1 0; min-height: 190px; display: flex; flex-direction: column; }
  .low { flex: 1 1 0; min-height: 120px; display: flex; flex-direction: column; }
  .split { flex: none; height: 9px; display: flex; align-items: center; justify-content: center; background: var(--panel-2); border-block: 1px solid var(--line); cursor: row-resize; touch-action: none; }
  .split i { width: 40px; height: 3px; background: var(--line-hi); }
  .split:hover i, .split:focus-visible i { background: var(--cyan); }
  .enemy { background: var(--panel); padding: 8px 10px 0; display: grid; gap: 5px; }
  .stats { display: flex; align-items: center; gap: 14px; }
  .st { display: inline-flex; align-items: center; gap: 5px; color: var(--cyan); font-size: 13px; }
  .st b { color: var(--text); font-weight: 600; }
  .st em { font-style: normal; color: var(--dim); font-size: 12px; }
  .st.low b { color: var(--red); }
  .bar.hull { height: 6px; } .bar.hull.low > i { background: var(--red); }
  .viewbox { position: relative; padding: 8px; flex: 1 1 auto; min-height: 100px; display: flex; background: var(--panel); }
    /* Absolute: the canvas's pixel size (set to the device px it covers) must not feed back into the layout. */
  .view { position: absolute; inset: 8px; width: calc(100% - 16px); height: calc(100% - 16px); display: block; cursor: crosshair; background: #04070b; image-rendering: pixelated; outline: 1px solid var(--line); outline-offset: -1px; }
  .none { background: var(--panel); color: var(--dim); margin: 0; padding: 10px; }
</style>
