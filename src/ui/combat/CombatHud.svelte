<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { UiJumpWarnings } from '../starmapApi';
  import type { UiAiming, UiApi, UiBoarding, UiCombat, UiShipCombat } from '../api';
  import InsetFrame from './InsetFrame.svelte';
  import EnemyCard from './EnemyCard.svelte';
  import JumpConfirm from '../JumpConfirm.svelte';
  import BoardingCard from './BoardingCard.svelte';
  import { TICK_HZ } from '../../sim/time';
  import { nextHeatRate, type HeatSample } from './heatRate';
  import { keymap, MODE_ACTIONS, WEAPON_ACTIONS, type ActionId } from '../keymap';
  import IncomingReadout from './IncomingReadout.svelte';
  import PlayerStrip from './PlayerStrip.svelte';
  import ModuleQuickPanel from './ModuleQuickPanel.svelte';
  import { isTypingTarget, modalOpen } from '../keys';
  import './steel.css';

  /**
   * The combat view (issue #186): while in combat this replaces the colony panels. Enemy card top left, your ship's strip along the bottom.
   * Targeting happens in the world: a weapon card arms "target in view", and the main view's hover brackets and click do the rest.
   */
  let { api, combat }: { api: UiApi; combat: UiCombat } = $props();

  type System = 'weapons' | 'shields' | 'engines';
  let aiming = $state<UiAiming | null>(null);
  let boarding = $state<UiBoarding[]>([]);
  const enemy = $derived<UiShipCombat | undefined>(
    combat.enemies.find((e) => e.state === 'active' || e.state === 'disabled') ?? combat.enemies[0],
  );
  const me = $derived(combat.player);

  const vent = () => me && api.dispatch({ type: 'combat.vent', ship: me.ship });
  const overcharge = (system: System) => me && api.dispatch({ type: 'combat.overcharge', ship: me.ship, system });

  // Net heat rate (%/s): see heatRate.ts.
  let tick = $state(0);
  let rate = $state(0);
  let last: HeatSample | null = null;
  $effect(() => {
    const h = me?.heat;
    if (!h) {
      last = null;
      return;
    }
    const next = nextHeatRate(rate, last, { tick, pct: (h.value / h.max) * 100 }, TICK_HZ);
    last = next.last;
    if (next.rate !== rate) rate = next.rate;
  });
  const shownRate = $derived(rate);

  const pill = $derived.by((): { text: string; tone: string } => {
    if (!enemy) return { text: 'Clear', tone: 'dim' };
    if (enemy.state === 'disabled') return { text: 'Disabled', tone: 'amber' };
    if (enemy.state !== 'active') return { text: enemy.state, tone: 'dim' };
    if (enemy.heat.lockout > 0) return { text: 'Overheated', tone: 'green' };
    if (me?.hold || me?.holdAll) return { text: 'You hold fire', tone: 'amber' };
    if (enemy.shield.max > 0 && enemy.shield.layers === 0) return { text: 'Shields down', tone: 'green' };
    return { text: 'Hostile', tone: 'red' };
  });
  const helmManned = $derived(!!me?.consoles.some((c) => c.kind === 'helm' && c.powered && c.operator !== null));

  // The main view shows the enemy (the ships are usually too far apart to frame together); your ship sits in the inset. Swap flips them.
  let swapped = $state(false);
  const mainShip = $derived((swapped ? me?.ship : enemy?.ship) ?? 0);
  const insetShip = $derived((swapped ? enemy?.ship : me?.ship) ?? 0);
  $effect(() => {
    if (mainShip) api.focusFight(mainShip);
  });
  const swap = () => (swapped = !swapped);
  // The module quick panel belongs to your ship in the main view: swapping back drops the selection.
  $effect(() => {
    if (!swapped) api.selectModule(null);
  });

  // A new hostile ship starts as the ship-wide target (as the old panel did), and the camera frames both ships once.
  let autoAimed = 0;
  $effect(() => {
    if (me && enemy && enemy.state !== 'wreck' && !me.target && autoAimed !== enemy.ship) {
      autoAimed = enemy.ship;
      api.dispatch({ type: 'combat.setTarget', ship: me.ship, weaponId: null, targetShip: enemy.ship, targetModuleId: 0 });
    }
  });

  const select = (id: number) => api.setAiming(aiming?.weapon === id ? null : { weapon: id });
  const drive = $derived(me ? { charge: me.ftl, max: me.ftlMax, helmManned, active: me.state === 'active' } : null);
  // Fleeing jumps: with crew or shuttles that would stay behind, ask first (the same confirmation the starmap uses).
  let leaving = $state<UiJumpWarnings | null>(null);
  const doFlee = () => { leaving = null; if (me) api.dispatch({ type: 'combat.flee', ship: me.ship }); };
  const flee = () => {
    if (!me) return;
    const w = api.jumpWarnings(me.ship);
    if (w.crew.length || w.vehicles.length) leaving = { ...w, hostileDocked: [] };
    else doFlee();
  };

  /** Run a key's action and swallow the event so no other handler sees it. */
  function consume(e: KeyboardEvent): void {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
  function onKey(e: KeyboardEvent) {
    // A modal (the Esc menu, the flee/jump confirmation) owns the keys (Tab, Enter, Esc); so does leaving the fight.
    if (leaving || modalOpen() || e.ctrlKey || e.metaKey || e.altKey || !me || isTypingTarget(e)) return;
    const is = (id: ActionId) => keymap.matches(e, id);
    if (is('combat.swap')) {
      consume(e);
      swap();
      return;
    }
    const slot = WEAPON_ACTIONS.findIndex(is);
    const mode = MODE_ACTIONS.findIndex(is);
    const strip = slot >= 0 || mode >= 0 || (['combat.volley', 'combat.holdAll', 'combat.flee', 'combat.vent'] as const).some(is);
    // Thermal overload: the strip is locked.
    if (me.heat.lockout > 0 && strip) return consume(e);
    // A weapon slot's mode key flips it between AUTO and HOLD.
    if (mode >= 0) {
      const w = me.weapons[mode];
      if (!w) return; // no weapon in that slot: the key falls through (Shift+R rotates a module back)
      api.dispatch({ type: 'combat.setWeaponMode', ship: me.ship, weaponId: w.id, mode: w.mode === 'hold' ? 'auto' : 'hold' });
      return consume(e);
    }
    // A slot key picks its weapon. With no weapon in the slot the key falls through, so R still drafts crew on a ship with three weapons.
    if (slot >= 0) {
      const w = me.weapons[slot];
      if (!w) return;
      select(w.id);
    } else if (is('combat.volley')) api.dispatch({ type: 'combat.fireVolley', ship: me.ship });
    else if (is('combat.holdAll')) api.dispatch({ type: 'combat.holdAll', ship: me.ship, hold: !me.holdAll });
    else if (is('combat.flee')) {
      if (me.ftl >= me.ftlMax) flee();
    } else if (is('combat.vent')) vent();
    else return;
    consume(e);
  }
  onMount(() => {
    const un = api.aiming.subscribe((a) => (aiming = a));
    const un3 = api.boarding.subscribe((b) => (boarding = b));
    const un2 = api.snapshot.subscribe((x) => {
      tick = x.tick;
    });
    window.addEventListener('keydown', onKey, true);
    return () => {
      un();
      un2();
      un3();
      window.removeEventListener('keydown', onKey, true);
    };
  });
  onDestroy(() => api.setAiming(null));
</script>

<div class="hud" data-testid="combat-hud">
  {#if enemy}
    <div class="top">
      <EnemyCard {enemy} state={pill} onFrame={() => api.focusFight(mainShip)} />
      {#each boarding as b (b.ship)}<BoardingCard {api} {b} named={boarding.length > 1} />{/each}
    </div>
  {/if}
  {#if me && insetShip}
    <div class="insetdock">
      <InsetFrame {api} ship={insetShip} title={swapped ? 'Enemy ship' : 'Your ship'} threatened={me.incoming.length > 0} onSwap={swap} />
    </div>
  {/if}
  {#if me && swapped}
    <ModuleQuickPanel {api} ship={me.ship} />
  {/if}
  {#if me && me.incoming.length > 0}
    <div class="incoming"><IncomingReadout shots={me.incoming} /></div>
  {/if}
  {#if me}
    <div class="bot">
      <PlayerStrip {api} {me} {flee} {drive} {aiming} onSelect={select} rate={shownRate} onVent={vent} onOvercharge={overcharge} />
    </div>
  {/if}
  <JumpConfirm warnings={leaving} onConfirm={doFlee} onCancel={() => (leaving = null)} />
</div>

<style>
  .hud {
    position: fixed;
    inset: 0;
    z-index: 5;
    pointer-events: none;
  }
  .top {
    position: absolute;
    left: calc(var(--gutter) + var(--sal));
    top: calc(34px + var(--sat));
    display: grid;
    gap: 10px;
  }
  /* Clear of the strip (182px tall, 8px off the bottom) with a gutter between. */
  .insetdock {
    position: absolute;
    left: calc(var(--gutter) + var(--sal));
    bottom: calc(var(--gutter) + var(--sab) + 192px);
  }
  .incoming {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(var(--gutter) + var(--sab) + 192px);
  }
  .bot {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(var(--gutter) + var(--sab));
    display: flex;
    justify-content: center;
  }
</style>
